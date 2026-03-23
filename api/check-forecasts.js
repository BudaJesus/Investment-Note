import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════
// 예측 자동 평가 + 주간 피드백 루프
// 
// 매일 cron: 확인일 도래한 예측을 Yahoo Finance로 비교
// 매주 일요일 cron: 피드백 루프 → prompt_injection 갱신
// ═══════════════════════════════════════════════════

/**
 * Yahoo Finance에서 현재가 가져오기
 */
async function getYahooPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (e) { return null; }
}

/**
 * Gemini Flash로 예측 vs 실제 비교 평가
 */
async function evaluatePrediction(prediction, actualData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `예측과 실제 결과를 비교해주세요.

예측 유형: ${prediction.type}
예측 내용: ${prediction.prediction}
목표 레인지: ${prediction.target_range || '없음'}
확신도: ${prediction.confidence}%
실제 데이터: ${JSON.stringify(actualData)}

아래 JSON으로만 응답:
{
  "status": "hit 또는 partial 또는 miss",
  "actual_result": "실제 결과 요약 1문장",
  "evaluation_note": "평가 근거 1~2문장"
}

판정 기준:
- hit: 수치 예측은 레인지 내 적중, 방향 예측은 방향+스토리 모두 맞음
- partial: 방향은 맞았으나 수치 범위 벗어남, 또는 스토리 일부만 맞음
- miss: 방향 자체가 틀림`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) { return null; }
}

/**
 * 카테고리별 Yahoo 심볼 매핑
 */
const CATEGORY_SYMBOLS = {
  us_equity: '^GSPC',
  kr_equity: '^KS11',
  commodities: 'GC=F',
  fx: 'KRW=X',
  bonds: '^TNX',
};

/**
 * 확인일 도래 예측 평가
 */
async function evaluatePendingForecasts() {
  const today = new Date().toISOString().slice(0, 10);

  // 확인일이 오늘 이전이고 아직 pending인 예측 가져오기
  const { data: pending, error } = await supabase
    .from('forecasts')
    .select('*')
    .eq('status', 'pending')
    .lte('check_date', today)
    .order('check_date', { ascending: true })
    .limit(20);

  if (error || !pending || pending.length === 0) {
    return { evaluated: 0, results: [] };
  }

  const results = [];

  for (const forecast of pending) {
    // 수치 예측: Yahoo에서 실제가 가져오기
    let actualData = {};

    if (forecast.type === 'numeric' || forecast.type === 'direction') {
      const symbol = CATEGORY_SYMBOLS[forecast.category];
      if (symbol) {
        const price = await getYahooPrice(symbol);
        if (price) actualData.current_price = price;
      }
    }

    // AI 평가
    const evaluation = await evaluatePrediction(forecast, actualData);

    if (evaluation) {
      // Supabase 업데이트
      await supabase
        .from('forecasts')
        .update({
          status: evaluation.status,
          actual_result: evaluation.actual_result,
          actual_value: actualData.current_price ? String(actualData.current_price) : '',
          evaluation_note: evaluation.evaluation_note,
          evaluated_at: new Date().toISOString(),
        })
        .eq('id', forecast.id);

      results.push({
        id: forecast.id,
        prediction: forecast.prediction.slice(0, 50),
        status: evaluation.status,
      });
    }

    // rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  return { evaluated: results.length, results };
}

/**
 * 주간 피드백 루프 생성 (매주 일요일)
 */
async function generateWeeklyFeedback(userId) {
  // 최근 90일 평가된 예측 가져오기
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const { data: evaluated, error } = await supabase
    .from('forecasts')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'pending')
    .gte('evaluated_at', cutoff.toISOString())
    .order('evaluated_at', { ascending: false });

  if (error || !evaluated || evaluated.length < 3) {
    return null; // 최소 3개 이상 평가된 예측이 있어야 의미 있음
  }

  // 적중률 계산
  const total = evaluated.length;
  const hits = evaluated.filter(f => f.status === 'hit').length;
  const partials = evaluated.filter(f => f.status === 'partial').length;
  const misses = evaluated.filter(f => f.status === 'miss').length;
  const overall = Math.round((hits + partials * 0.5) / total * 100);

  // 카테고리별 적중률
  const byCategory = {};
  const categories = [...new Set(evaluated.map(f => f.category))];
  for (const cat of categories) {
    const catForecasts = evaluated.filter(f => f.category === cat);
    const catHits = catForecasts.filter(f => f.status === 'hit').length;
    const catPartials = catForecasts.filter(f => f.status === 'partial').length;
    byCategory[cat] = Math.round((catHits + catPartials * 0.5) / catForecasts.length * 100);
  }

  // 유형별 적중률
  const byType = {};
  const types = [...new Set(evaluated.map(f => f.type))];
  for (const t of types) {
    const tForecasts = evaluated.filter(f => f.type === t);
    const tHits = tForecasts.filter(f => f.status === 'hit').length;
    const tPartials = tForecasts.filter(f => f.status === 'partial').length;
    byType[t] = Math.round((tHits + tPartials * 0.5) / tForecasts.length * 100);
  }

  const hitRates = {
    overall,
    by_category: byCategory,
    by_type: byType,
    total_evaluated: total,
    hits, partials, misses,
    period: '최근 90일',
  };

  // AI 자기 분석 (Gemini Flash)
  let analysis = { strengths: [], weaknesses: [], adjustments: [] };
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `아래 예측 적중률 데이터를 분석하고 개선점을 제안하세요.

전체 적중률: ${overall}%
카테고리별: ${JSON.stringify(byCategory)}
유형별: ${JSON.stringify(byType)}
총 평가 건수: ${total}건 (Hit ${hits}, Partial ${partials}, Miss ${misses})

최근 Miss 사례:
${evaluated.filter(f => f.status === 'miss').slice(0, 3).map(f => `- [${f.category}/${f.type}] ${f.prediction} → ${f.actual_result}`).join('\n')}

JSON으로만 응답:
{
  "strengths": [{ "category": "잘하는 분야", "rate": 적중률, "description": "이유" }],
  "weaknesses": [{ "category": "약한 분야", "rate": 적중률, "pattern": "반복되는 패턴" }],
  "adjustments": [{ "rule": "조정 규칙", "reason": "이유" }]
}`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 1000, temperature: 0.3 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        analysis = JSON.parse(cleaned);
      }
    }
  } catch (e) {}

  // prompt_injection 구성 (다음 전망 생성 시 system prompt에 주입)
  const promptInjection = `[AI 예측 피드백 — ${new Date().toISOString().slice(0, 10)} 기준]
전체 적중률: ${overall}% (${total}건 평가, Hit ${hits} / Partial ${partials} / Miss ${misses})

카테고리별 성과:
${Object.entries(byCategory).map(([k, v]) => `- ${k}: ${v}%${v >= 70 ? ' (strong)' : v < 55 ? ' (weak)' : ''}`).join('\n')}

유형별 성과:
${Object.entries(byType).map(([k, v]) => `- ${k}: ${v}%`).join('\n')}

${analysis.weaknesses?.length > 0 ? `약점 패턴:\n${analysis.weaknesses.map(w => `- ${w.category}: ${w.pattern}`).join('\n')}` : ''}

${analysis.adjustments?.length > 0 ? `적용할 조정 규칙:\n${analysis.adjustments.map(a => `- ${a.rule} (이유: ${a.reason})`).join('\n')}` : ''}

위 피드백을 반영하여 약한 카테고리에서는 확신도를 낮추고, 예측 레인지를 넓히세요.`;

  // ISO week 계산
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  // Supabase 저장
  const { error: saveError } = await supabase
    .from('feedback_prompts')
    .upsert({
      user_id: userId,
      week_key: weekKey,
      hit_rates: hitRates,
      analysis,
      prompt_injection: promptInjection,
    }, { onConflict: 'user_id,week_key' });

  return { weekKey, hitRates, analysis, saved: !saveError };
}

// ═══════════════════════════════════════════════════
// API Handler
// ?mode=evaluate  — 확인일 도래 예측 평가 (매일 cron)
// ?mode=feedback   — 주간 피드백 루프 (일요일 cron)
// ?mode=all        — 둘 다 (기본)
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const mode = req.query?.mode || 'all';
    const userId = req.query?.user_id;

    const results = {};

    // 예측 평가
    if (mode === 'all' || mode === 'evaluate') {
      results.evaluation = await evaluatePendingForecasts();
    }

    // 피드백 루프 (일요일이거나 mode=feedback)
    const dayOfWeek = new Date().getDay(); // 0 = 일요일
    if (mode === 'feedback' || (mode === 'all' && dayOfWeek === 0)) {
      if (!userId) {
        results.feedback = { error: 'user_id required for feedback generation' };
      } else {
        results.feedback = await generateWeeklyFeedback(userId);
      }
    }

    return res.status(200).json({
      success: true,
      mode,
      ...results,
    });

  } catch (e) {
    console.error('check-forecasts error:', e);
    return res.status(500).json({ error: e.message });
  }
}
