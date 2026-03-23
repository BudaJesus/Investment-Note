import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════
// Claude Sonnet — 시장전망 + 종목분석 생성
// "🔄 데이터 수집 + AI 분석" 버튼에서 호출
// ═══════════════════════════════════════════════════

async function callClaude(systemPrompt, userPrompt, maxTokens = 4000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

/**
 * 최신 데이터 수집 (Yahoo + Investing.com + Telegram)
 */
async function gatherData() {
  const result = {
    yahooData: {},
    investingData: {},
    telegramDigest: null,
    feedbackPrompt: null,
  };

  // 1. auto_data (최신 시장 수치)
  try {
    const { data } = await supabase
      .from('auto_data')
      .select('yahoo_data, investing_data, fetched_at')
      .order('date_key', { ascending: false })
      .limit(1)
      .single();
    if (data) {
      result.yahooData = data.yahoo_data || {};
      result.investingData = data.investing_data || {};
    }
  } catch (e) {}

  // 2. telegram_digests (최신 수집)
  try {
    const { data } = await supabase
      .from('telegram_digests')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();
    if (data) result.telegramDigest = data;
  } catch (e) {}

  // 3. feedback_prompts (최신 피드백 루프)
  try {
    const { data } = await supabase
      .from('feedback_prompts')
      .select('prompt_injection, hit_rates, analysis')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();
    if (data) result.feedbackPrompt = data;
  } catch (e) {}

  return result;
}

/**
 * 소스 태그 결정: 어떤 시장/섹터에 대해 텔레그램/리포트/AI 중 어떤 소스가 있는지
 */
function determineSourceTags(telegramDigest) {
  const tags = {};
  const markets = telegramDigest?.market_summaries || {};

  const marketMap = {
    us: 'us_macro', kr: 'kr_macro', jp: 'jp_macro',
    cn: 'cn_macro', tw: 'tw_macro', bonds: 'bonds',
    fx: 'fx', commodities: 'commodities', sectors: 'sectors',
  };

  for (const [key, mKey] of Object.entries(marketMap)) {
    const hasTg = markets[key]?.summary?.length > 0;
    const hasReport = (telegramDigest?.report_summaries || []).length > 0;

    if (hasTg && hasReport) tags[mKey] = ['tg', 'report'];
    else if (hasTg) tags[mKey] = ['tg'];
    else if (hasReport) tags[mKey] = ['report'];
    else tags[mKey] = ['ai']; // 텔레그램·리포트 소스 없음 → AI가 보완
  }

  return tags;
}

/**
 * 시장전망 (market_view) 생성
 */
async function generateMarketView(data) {
  const { yahooData, investingData, telegramDigest, feedbackPrompt } = data;

  // 시장 수치 요약 구성
  const priceMap = {};
  const keys = ['sp500', 'nasdaq', 'dow', 'kospi', 'kosdaq', 'nikkei', 'shanghai', 'taiex',
    'us10y', 'kr10y', 'gold', 'oil', 'btc', 'usdkrw', 'usdjpy', 'dxy'];
  for (const k of keys) {
    if (yahooData[k]) priceMap[k] = yahooData[k];
  }

  // 텔레그램 시장별 요약
  const tgMarkets = telegramDigest?.market_summaries || {};
  const tgArticles = telegramDigest?.article_summaries || [];

  // 피드백 루프 주입
  const feedbackInjection = feedbackPrompt?.prompt_injection || '';

  const systemPrompt = `당신은 투자 전문 AI 애널리스트입니다. Top-Down 방식으로 시장을 분석하고 1억 원 포트폴리오를 설계합니다.

${feedbackInjection ? `[피드백 루프 — 과거 예측 분석 결과]\n${feedbackInjection}\n` : ''}

응답은 반드시 아래 JSON 형식으로만 해주세요. JSON 외의 텍스트는 절대 포함하지 마세요.`;

  const userPrompt = `## 최신 시장 데이터
${JSON.stringify(priceMap, null, 1)}

## 경제지표 (최신 발표)
${JSON.stringify(Object.fromEntries(
  Object.entries(investingData).slice(0, 15).map(([k, v]) => [k, {
    latest: v?.records?.[0]?.actual,
    date: v?.records?.[0]?.date,
    next_date: v?.next_date,
  }])
), null, 1)}

## 텔레그램 채널 시장별 요약
${JSON.stringify(tgMarkets, null, 1)}

## 텔레그램 기사 요약 (최신 ${tgArticles.length}건)
${tgArticles.slice(0, 5).map(a => `- [${a.category}] ${a.title}: ${a.summary}`).join('\n')}

---

위 데이터를 기반으로 아래 JSON을 작성하세요:

{
  "indicators": { "kospi": { "value": "수치", "change": "+0.5%" }, "sp500": {...}, "nasdaq": {...}, "usdkrw": {...}, "gold": {...}, "wti": {...}, "nikkei": {...}, "shanghai": {...}, "taiex": {...}, "us10y": {...}, "kr_rate": {...}, "us_rate": {...} },
  "macro": {
    "global": "글로벌 매크로 전망 (5~8문장, 핵심변수 3개 포함)",
    "us": "미국 전망 (5~8문장, PEG 포함)",
    "kr": "한국 전망 (5~8문장, PEG 포함)",
    "jp": "일본 전망 (3~5문장, PEG 포함)",
    "cn": "중국 전망 (3~5문장, PEG 포함)",
    "tw": "대만 전망 (3~5문장, PEG 포함)"
  },
  "fx": "환율 전망 (원/달러 레인지 + 상승/하락 요인 각 3개)",
  "themes": [
    { "name": "테마명", "tag": "bu/be/ne", "description": "설명" }
  ],
  "allocation": {
    "domestic": { "pct": 35, "amount": 3500, "detail": "설명" },
    "overseas": { "pct": 25, "amount": 2500, "detail": "설명" },
    "gold": { "pct": 15, "amount": 1500, "detail": "설명" },
    "bonds": { "pct": 15, "amount": 1500, "detail": "설명" },
    "cash": { "pct": 10, "amount": 1000, "detail": "설명" }
  },
  "domestic_stocks": [
    { "name": "종목명", "ticker": "005930", "weight_pct": 10, "amount": 1000, "reason": "편입 이유 1줄" }
  ],
  "overseas_stocks": [
    { "name": "종목명", "ticker": "NVDA", "weight_pct": 7, "amount": 700, "reason": "편입 이유 1줄" }
  ],
  "gold_bonds_cash": [
    { "name": "자산명", "weight_pct": 10, "amount": 1000, "reason": "이유" }
  ],
  "scenarios": [
    { "name": "시나리오A", "tag": "bu/be/ne", "description": "설명" }
  ],
  "speaking_guide": "30초 면접 스피킹 가이드 (3~4문장)",
  "predictions": [
    { "category": "us_equity/kr_equity/commodities/fx/sector/bonds/geopolitical/structural",
      "type": "numeric/direction/story/event",
      "prediction": "예측 내용",
      "target_range": "5800~5950",
      "confidence": 65,
      "timeframe": "1개월",
      "check_date": "2026-04-23" }
  ]
}`;

  const result = await callClaude(systemPrompt, userPrompt, 6000);

  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Market view parse error:', e.message);
    return null;
  }
}

/**
 * 종목분석 (stock_analysis) 생성
 */
async function generateStockAnalysis(data, marketView) {
  const { yahooData, telegramDigest, feedbackPrompt } = data;

  const feedbackInjection = feedbackPrompt?.prompt_injection || '';

  const systemPrompt = `당신은 증권사 리서치 애널리스트입니다. 포트폴리오 편입 종목의 상세 분석을 작성합니다.
PEG, PER, 영업이익, 목표가, 리스크를 반드시 포함하세요.
${feedbackInjection ? `\n[피드백 루프]\n${feedbackInjection}` : ''}
응답은 반드시 아래 JSON 형식으로만 해주세요.`;

  // 시장전망의 종목 리스트 전달
  const stocks = [
    ...(marketView?.domestic_stocks || []),
    ...(marketView?.overseas_stocks || []),
  ];

  const tgMarkets = telegramDigest?.market_summaries || {};

  const userPrompt = `## 포트폴리오 편입 종목
${JSON.stringify(stocks, null, 1)}

## 시장 수치
${JSON.stringify(Object.fromEntries(
  Object.entries(yahooData).slice(0, 10).map(([k, v]) => [k, v])
), null, 1)}

## 텔레그램 섹터 요약
${tgMarkets.sectors?.summary || '섹터별 정보 없음'}

---

아래 JSON을 작성하세요:

{
  "peg_table": [
    { "name": "코스피 전체", "fwd_per": 13, "eps_growth": 47, "peg": 0.28, "verdict": "극저평가" },
    { "name": "S&P500", "fwd_per": 21, "eps_growth": 13, "peg": 1.6, "verdict": "적정~고평가" }
  ],
  "sectors": [
    {
      "name": "반도체",
      "peg": 0.10,
      "peg_verdict": "극저평가",
      "stocks": [
        {
          "name": "삼성전자",
          "ticker": "005930",
          "market": "KRX",
          "weight_pct": 10,
          "overview": "기업개요 2~3문장",
          "products": "대표 제품/서비스",
          "price": "현재가",
          "market_cap": "시가총액",
          "per_ttm": "PER TTM",
          "per_fwd": "Forward PER",
          "peg": 0.25,
          "op_profit": "영업이익",
          "op_profit_estimate": "2026E 전망치",
          "target_price": "목표가 범위",
          "invest_points": ["투자포인트1 (2~3문장)", "투자포인트2", "투자포인트3"],
          "risks": "리스크 2~3개",
          "source_tags": ["tg", "report"]
        }
      ]
    }
  ],
  "overseas": [
    {
      "name": "해외 AI빅테크+에너지+배당",
      "peg": 1.6,
      "peg_verdict": "적정",
      "stocks": [
        {
          "name": "엔비디아",
          "ticker": "NVDA",
          "market": "NASDAQ",
          "weight_pct": 7,
          "overview": "기업개요",
          "products": "대표 제품",
          "price": "~$120",
          "per_fwd": 40,
          "peg": 0.80,
          "revenue_quarterly": "분기 매출",
          "fcf_quarterly": "분기 FCF",
          "invest_points": ["포인트1", "포인트2", "포인트3"],
          "risks": "리스크",
          "source_tags": ["tg", "ai"]
        }
      ]
    }
  ]
}

반도체, 조선방산, 전력기기, 자동차, 바이오 등 편입 종목 전체에 대해 상세하게 작성하세요.
source_tags는 텔레그램 소스가 있으면 "tg", 리포트 소스가 있으면 "report", AI가 보완했으면 "ai"를 배열로 넣으세요.`;

  const result = await callClaude(systemPrompt, userPrompt, 6000);

  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Stock analysis parse error:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════
// API Handler
// 포트폴리오 "🔄 데이터 수집 + AI 분석" 버튼에서 호출
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const userId = req.query?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });

    const dateKey = new Date().toISOString().slice(0, 10);

    // ── 1. 텔레그램 수집 먼저 실행 (최신 데이터 확보) ──
    try {
      await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/telegram-digest?type=manual`, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      // 텔레그램 수집 실패해도 기존 데이터로 계속 진행
      console.warn('Telegram digest call failed, continuing with existing data');
    }

    // ── 2. 모든 데이터 수집 ──
    const data = await gatherData();

    // ── 3. 시장전망 생성 (Claude Sonnet) ──
    const marketView = await generateMarketView(data);
    if (!marketView) {
      return res.status(500).json({ error: 'Market view generation failed' });
    }

    // ── 4. 종목분석 생성 (Claude Sonnet) ──
    const stockAnalysis = await generateStockAnalysis(data, marketView);

    // ── 5. 소스 태그 결정 ──
    const sourceTags = determineSourceTags(data.telegramDigest);

    // ── 6. 기존 버전 확인 + 새 버전 저장 ──
    let version = 1;
    try {
      const { data: existing } = await supabase
        .from('outlooks')
        .select('version')
        .eq('user_id', userId)
        .eq('date_key', dateKey)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      if (existing) version = existing.version + 1;
    } catch (e) {}

    const { error: saveError } = await supabase
      .from('outlooks')
      .insert({
        user_id: userId,
        date_key: dateKey,
        market_view: marketView,
        stock_analysis: stockAnalysis || {},
        sources: {
          telegram_digest_id: data.telegramDigest?.id || null,
          auto_data_fetched: data.yahooData ? true : false,
          investing_data_count: Object.keys(data.investingData).length,
        },
        source_tags: sourceTags,
        version,
      });

    if (saveError) {
      return res.status(500).json({ error: saveError.message });
    }

    // ── 7. 예측(predictions)을 forecasts 테이블에 저장 ──
    if (marketView.predictions?.length > 0) {
      const forecasts = marketView.predictions.map(p => ({
        user_id: userId,
        category: p.category,
        type: p.type,
        prediction: p.prediction,
        target_range: p.target_range || '',
        confidence: p.confidence || 50,
        timeframe: p.timeframe || '',
        check_date: p.check_date,
        status: 'pending',
        source: 'ai',
      }));

      await supabase.from('forecasts').insert(forecasts);
    }

    return res.status(200).json({
      success: true,
      date: dateKey,
      version,
      hasMarketView: !!marketView,
      hasStockAnalysis: !!stockAnalysis,
      predictionsCreated: marketView.predictions?.length || 0,
      sourceTags,
    });

  } catch (e) {
    console.error('generate-outlook error:', e);
    return res.status(500).json({ error: e.message });
  }
}
