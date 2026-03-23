import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callClaude(systemPrompt, userPrompt, maxTokens = 6000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

export default async function handler(req, res) {
  try {
    const t0 = Date.now();
    // 30일치 레포트 텍스트
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: reportDigests } = await supabase.from('telegram_digests')
      .select('report_texts, date_key')
      .gte('collected_at', thirtyDaysAgo.toISOString())
      .order('collected_at', { ascending: true }).limit(15);

    const t1 = Date.now();
    // 7일치 메시지 (레포트 관련)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: msgDigests } = await supabase.from('telegram_digests')
      .select('raw_messages, date_key')
      .gte('collected_at', sevenDaysAgo.toISOString())
      .order('collected_at', { ascending: false }).limit(3);

    const t2 = Date.now();
    console.log(`[report] DB queries: ${t1-t0}ms + ${t2-t1}ms`);

    // 레포트 텍스트 수집
    const allReports = [];
    for (const d of (reportDigests || [])) {
      for (const r of (d.report_texts || [])) allReports.push({ ...r, date: d.date_key || '' });
    }

    // 메시지에서 레포트 관련 키워드 필터
    const KEYWORDS = ['리포트','리서치','레포트','보고서','목표가','투자의견','BUY','SELL','매수','매도','비중확대','상향','하향','TP ','영업이익','컨센서스','실적발표','.pdf','커버리지','어닝'];
    const reportMsgs = [];
    for (const d of (msgDigests || [])) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          if (msg.text?.length > 30 && KEYWORDS.some(kw => msg.text.includes(kw))) {
            reportMsgs.push(`[${d.date_key || ''}][${handle}] ${msg.text.slice(0, 800)}`);
          }
        }
      }
    }

    if (allReports.length === 0 && reportMsgs.length === 0) {
      return res.status(200).json({ success: true, reports: [], debug: `reports=${allReports.length}, msgs=${reportMsgs.length}` });
    }

    const content = [
      allReports.length > 0 ? `=== PDF 레포트 (${allReports.length}개) ===` : '',
      ...allReports.slice(0, 5).map(r => `[${r.date}][파일: ${r.fileName}]\n${r.text.slice(0, 1500)}`),
      reportMsgs.length > 0 ? `\n=== 레포트 관련 메시지 (${reportMsgs.length}개) ===` : '',
      ...reportMsgs.slice(0, 25),
    ].filter(Boolean).join('\n---\n').slice(0, 20000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다.

핵심 규칙:
1. PDF 레포트가 이미 섹션별로 정리되어 있으면 그 구조를 그대로 활용하세요.
2. 요약하지 마세요. 원본의 수치, 데이터, 투자의견, 목표가, 분석 내용을 최대한 그대로 가져오세요.
3. summary에는 핵심 논점 + 데이터 + 결론을 빠짐없이 넣으세요. 길어도 됩니다 (10~20문장 가능).
4. 텔레그램 메시지의 '목표가 상향', '투자의견 매수' 등도 별도 레포트 항목으로 만드세요.
5. 최소 8개 이상 추출하세요. 많을수록 좋습니다.
6. summary 안에 큰따옴표(")를 쓰지 마세요. 작은따옴표(')를 사용하세요.

섹터 id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
증권사 id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
JSON 배열로만 응답하세요.`;

    const userPrompt = `${content}\n\nJSON 배열:\n[\n  { "title": "리포트 제목", "source": "증권사id", "sector": "섹터id", "analyst": "애널리스트명", "summary": "핵심논점+데이터+투자의견+목표가+결론 빠짐없이 정리. 10~20문장.", "stocks": "관련종목(쉼표구분)", "target_price": "목표가", "opinion": "매수/중립/매도", "rating": 3, "date": "${new Date().toISOString().slice(0,10)}" }\n]`;

    const t3 = Date.now();
    console.log(`[report] Data prep: ${t3-t2}ms, content: ${content.length} chars, reports: ${allReports.length}, msgs: ${reportMsgs.length}`);
    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const t4 = Date.now();
    console.log(`[report] Claude call: ${t4-t3}ms, response: ${result.length} chars`);
    let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let reports;
    try { reports = JSON.parse(cleaned); } catch (e1) {
      try {
        const s = cleaned.indexOf('['), e = cleaned.lastIndexOf(']');
        if (s >= 0 && e > s) reports = JSON.parse(cleaned.slice(s, e + 1));
        else throw new Error('No array');
      } catch (e2) {
        return res.status(500).json({ error: 'JSON 파싱 실패: ' + e2.message, raw: cleaned.slice(0, 500) });
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

    const t5 = Date.now();
    return res.status(200).json({ success: true, reports, count: reports.length, timing: { db: `${t2-t0}ms`, claude: `${t4-t3}ms`, total: `${t5-t0}ms` } });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: `${e.message} (시간: ${Date.now()}ms)`, stack: e.stack?.slice(0, 200) });
  }
}
