import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function getYahooPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (e) { return null; }
}

async function callGemini(prompt, maxTokens = 500) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) { return null; }
}

const CATEGORY_SYMBOLS = { us_equity: '^GSPC', kr_equity: '^KS11', commodities: 'GC=F', fx: 'KRW=X', bonds: '^TNX' };

async function evaluatePendingForecasts() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: pending } = await supabase.from('forecasts').select('*').eq('status', 'pending').lte('check_date', today).order('check_date').limit(20);
  if (!pending || pending.length === 0) return { evaluated: 0 };
  const results = [];
  for (const f of pending) {
    let actualData = {};
    if ((f.type === 'numeric' || f.type === 'direction') && CATEGORY_SYMBOLS[f.category]) {
      const price = await getYahooPrice(CATEGORY_SYMBOLS[f.category]);
      if (price) actualData.current_price = price;
    }
    const prompt = `예측: ${f.prediction}\n목표: ${f.target_range || '없음'}\n실제: ${JSON.stringify(actualData)}\n\nJSON으로만: {"status":"hit/partial/miss","actual_result":"결과 1문장","evaluation_note":"근거 1문장"}`;
    const result = await callGemini(prompt);
    if (result) {
      try {
        const ev = JSON.parse(result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
        await supabase.from('forecasts').update({ status: ev.status, actual_result: ev.actual_result, actual_value: actualData.current_price ? String(actualData.current_price) : '', evaluation_note: ev.evaluation_note, evaluated_at: new Date().toISOString() }).eq('id', f.id);
        results.push({ id: f.id, status: ev.status });
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { evaluated: results.length, results };
}

async function generateWeeklyFeedback(userId) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const { data: evaluated } = await supabase.from('forecasts').select('*').eq('user_id', userId).neq('status', 'pending').gte('evaluated_at', cutoff.toISOString());
  if (!evaluated || evaluated.length < 3) return null;
  const total = evaluated.length;
  const hits = evaluated.filter(f => f.status === 'hit').length;
  const partials = evaluated.filter(f => f.status === 'partial').length;
  const misses = evaluated.filter(f => f.status === 'miss').length;
  const overall = Math.round((hits + partials * 0.5) / total * 100);
  const byCategory = {};
  for (const cat of [...new Set(evaluated.map(f => f.category))]) {
    const cf = evaluated.filter(f => f.category === cat);
    byCategory[cat] = Math.round((cf.filter(f => f.status === 'hit').length + cf.filter(f => f.status === 'partial').length * 0.5) / cf.length * 100);
  }
  const byType = {};
  for (const t of [...new Set(evaluated.map(f => f.type))]) {
    const tf = evaluated.filter(f => f.type === t);
    byType[t] = Math.round((tf.filter(f => f.status === 'hit').length + tf.filter(f => f.status === 'partial').length * 0.5) / tf.length * 100);
  }
  const hitRates = { overall, by_category: byCategory, by_type: byType, total_evaluated: total, hits, partials, misses, period: '최근 90일' };

  let analysis = { strengths: [], weaknesses: [], adjustments: [] };
  const prompt = `적중률: ${overall}%\n카테고리별: ${JSON.stringify(byCategory)}\nMiss 사례: ${evaluated.filter(f=>f.status==='miss').slice(0,3).map(f=>`[${f.category}] ${f.prediction}`).join('; ')}\n\nJSON으로만: {"strengths":[{"category":"","rate":0,"description":""}],"weaknesses":[{"category":"","rate":0,"pattern":""}],"adjustments":[{"rule":"","reason":""}]}`;
  const result = await callGemini(prompt, 1000);
  if (result) { try { analysis = JSON.parse(result.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()); } catch(e){} }

  const promptInjection = `[AI 피드백 ${new Date().toISOString().slice(0,10)}] 적중률 ${overall}%(${total}건). 약점: ${Object.entries(byCategory).filter(([,v])=>v<55).map(([k,v])=>`${k}:${v}%`).join(', ')||'없음'}. ${analysis.adjustments?.map(a=>a.rule).join('. ')||''}`;
  const now = new Date();
  const weekNum = Math.ceil(((now - new Date(now.getFullYear(),0,1)) / 86400000 + new Date(now.getFullYear(),0,1).getDay() + 1) / 7);
  const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;

  await supabase.from('feedback_prompts').upsert({ user_id: userId, week_key: weekKey, hit_rates: hitRates, analysis, prompt_injection: promptInjection }, { onConflict: 'user_id,week_key' });
  return { weekKey, hitRates };
}

export default async function handler(req, res) {
  try {
    const mode = req.query?.mode || 'all';
    const userId = req.query?.user_id;
    const results = {};
    if (mode === 'all' || mode === 'evaluate') results.evaluation = await evaluatePendingForecasts();
    if (mode === 'feedback' || (mode === 'all' && new Date().getDay() === 0)) {
      if (userId) results.feedback = await generateWeeklyFeedback(userId);
    }
    return res.status(200).json({ success: true, mode, ...results });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
