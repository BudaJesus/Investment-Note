import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callClaude(systemPrompt, userPrompt, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text().then(t => t.slice(0, 200)).catch(() => '')}`);
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

export default async function handler(req, res) {
  const t0 = Date.now();
  try {
    // report_texts만 가져옴 — raw_messages 제외 (이게 느린 원인이었음)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: digests, error: dbErr } = await supabase.from('telegram_digests')
      .select('report_texts, date_key')
      .gte('collected_at', sevenDaysAgo.toISOString())
      .order('collected_at', { ascending: true }).limit(10);

    const t1 = Date.now();
    if (dbErr) return res.status(500).json({ error: `DB 오류: ${dbErr.message}`, timing: `${t1-t0}ms` });

    const allReports = [];
    for (const d of (digests || [])) {
      for (const r of (d.report_texts || [])) allReports.push({ ...r, date: d.date_key || '' });
    }

    if (allReports.length === 0) {
      return res.status(200).json({ success: true, reports: [], debug: `레포트 텍스트 0개. digests=${digests?.length || 0}`, timing: `DB ${t1-t0}ms` });
    }

    const content = allReports.slice(0, 8).map(r => 
      `[${r.date}][${r.fileName}]\n${r.text.slice(0, 2500)}`
    ).join('\n===\n').slice(0, 25000);

    const systemPrompt = `증권사 리서치 편집자. 레포트를 정리합니다.
규칙: 요약 아님. 수치/목표가/투자의견/데이터/근거 빠짐없이 정리.
summary는 최대한 상세하게: 핵심논점, 실적 수치, 밸류에이션, 투자의견 근거, 리스크, 결론 전부 포함. 15~30문장.
summary 안에 큰따옴표 금지(작은따옴표 사용).
섹터id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
증권사id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
JSON 배열만 출력.`;

    const userPrompt = `레포트 ${allReports.length}개:\n\n${content}\n\n[{ "title":"", "source":"증권사id", "sector":"섹터id", "analyst":"", "summary":"빠짐없이 상세 정리(15~30문장). 수치/근거/결론 전부.", "stocks":"종목(쉼표)", "target_price":"", "opinion":"매수/중립/매도", "rating":3, "date":"${new Date().toISOString().slice(0,10)}" }]`;

    const t2 = Date.now();
    const result = await callClaude(systemPrompt, userPrompt, 8000);
    const t3 = Date.now();

    let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let reports;
    try { reports = JSON.parse(cleaned); } catch (e1) {
      try {
        const s = cleaned.indexOf('['), e = cleaned.lastIndexOf(']');
        if (s >= 0 && e > s) reports = JSON.parse(cleaned.slice(s, e + 1));
        else throw new Error('No array');
      } catch (e2) {
        return res.status(500).json({ error: 'JSON 파싱 실패', raw: cleaned.slice(0, 500), timing: `DB ${t1-t0}ms, Claude ${t3-t2}ms` });
      }
    }

    if (!Array.isArray(reports)) reports = [];
    reports = reports.filter(r => r && typeof r === 'object').map(r => ({
      title: String(r.title || ''), source: String(r.source || 'other'), sector: String(r.sector || 'other'),
      analyst: String(r.analyst || ''), summary: String(r.summary || ''),
      stocks: String(r.stocks || ''), target_price: String(r.target_price || ''),
      opinion: String(r.opinion || ''), rating: Number(r.rating) || 3,
      date: String(r.date || new Date().toISOString().slice(0, 10)),
    }));

    return res.status(200).json({ success: true, reports, count: reports.length, timing: `DB ${t1-t0}ms, Claude ${t3-t2}ms, 총 ${Date.now()-t0}ms` });
  } catch (e) {
    return res.status(500).json({ error: e.message, timing: `${Date.now()-t0}ms`, stack: e.stack?.slice(0, 300) });
  }
}
