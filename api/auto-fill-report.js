import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callClaude(systemPrompt, userPrompt, maxTokens = 4000) {
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
    // 최근 3개 digest에서 레포트+메시지 모으기
    const { data: digests, error } = await supabase
      .from('telegram_digests')
      .select('report_texts, raw_messages, collected_at')
      .order('collected_at', { ascending: false })
      .limit(3);

    if (error) return res.status(500).json({ error: error.message });
    if (!digests || digests.length === 0) return res.status(400).json({ error: 'No digest data. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });

    // 레포트 합치기
    const allReports = [];
    for (const d of digests) {
      for (const r of (d.report_texts || [])) allReports.push(r);
    }

    // 메시지에서 레포트 관련 내용 추출
    const reportMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          if (msg.text.includes('리포트') || msg.text.includes('보고서') || msg.text.includes('레포트') || msg.text.includes('목표가') || msg.text.includes('투자의견') || msg.text.includes('BUY') || msg.text.includes('매수') || msg.text.includes('.pdf'))
            reportMessages.push(`[${handle}] ${msg.text.slice(0, 800)}`);
        }
      }
    }

    if (allReports.length === 0 && reportMessages.length === 0) {
      return res.status(400).json({ error: '수집된 레포트 관련 정보가 없습니다. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });
    }

    const content = [
      '=== PDF 레포트 ===',
      ...allReports.map(r => `파일: ${r.fileName}\n${r.text.slice(0, 1500)}`),
      '\n=== 채널 내 레포트/투자의견 관련 메시지 ===',
      ...reportMessages.slice(0, 30),
    ].join('\n---\n').slice(0, 50000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다. 레포트 텍스트와 관련 메시지를 분석하여 레포트 아카이브 형식으로 정리합니다.
섹터 id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
증권사 id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
가능한 많은 레포트를 추출하세요 (최소 5개).
메시지에서 "목표가 상향", "투자의견 매수", "리포트 발간" 등의 내용도 레포트로 추출하세요.
JSON 배열로만 응답하세요.`;

    const userPrompt = `아래 레포트+메시지에서 레포트를 정리하세요:\n\n${content}\n\nJSON 배열:\n[\n  { "title": "레포트 제목", "source": "증권사id", "sector": "섹터id", "summary": "3~5문장 핵심 요약", "stocks": "관련종목(쉼표구분)", "rating": 3, "date": "${new Date().toISOString().slice(0,10)}" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const reports = JSON.parse(cleaned);

    return res.status(200).json({ success: true, reports, count: reports.length });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: e.message });
  }
}
