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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: digests, error } = await supabase
      .from('telegram_digests')
      .select('*')
      .gte('collected_at', thirtyDaysAgo.toISOString())
      .order("collected_at", { ascending: true })
      .limit(20);

    if (error || !digests || digests.length === 0)
      return res.status(200).json({ success: true, reports: [], debug: 'No digests found' });

    // 1. 레포트 텍스트
    const allReports = [];
    for (const d of digests) {
      for (const r of (d.report_texts || [])) allReports.push(r);
    }

    // 2. 모든 메시지를 가져와서 Claude가 레포트 관련 내용을 직접 추출하게 함
    // (키워드 매칭 대신 AI에게 맡김)
    const allMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          if (msg.text && msg.text.length > 30) {
            allMessages.push(`[${handle}] ${msg.text.slice(0, 800)}`);
          }
        }
      }
    }

    if (allReports.length === 0 && allMessages.length === 0) {
      return res.status(200).json({ success: true, reports: [], debug: `No data. reports=${allReports.length}, messages=${allMessages.length}, digests=${digests.length}` });
    }

    const content = [
      allReports.length > 0 ? `=== PDF 레포트 (${allReports.length}개) ===` : '',
      ...allReports.map(r => `[파일: ${r.fileName}]\n${r.text.slice(0, 1500)}`),
      `\n=== 텔레그램 메시지 전체 (${allMessages.length}개) ===`,
      `아래 메시지에서 증권사 리포트/리서치 관련 내용을 찾아 정리하세요:`,
      ...allMessages.slice(0, 50),
    ].filter(Boolean).join('\n---\n').slice(0, 50000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다. 레포트 텍스트와 텔레그램 메시지에서 증권사 리포트를 추출하여 정리합니다.

핵심 규칙:
1. PDF 레포트는 이미 섹션별로 정리되어 있습니다. 이 구조를 그대로 활용하세요.
2. 요약하지 마세요. 원본의 수치, 데이터, 투자의견, 목표가, 분석 내용을 최대한 그대로 가져오세요.
3. summary 필드에는 핵심 논점 + 데이터 + 결론을 빠짐없이 넣으세요. 길어도 됩니다.
4. 텔레그램 메시지에서 "목표가 상향", "투자의견 매수" 등이 있으면 그것도 별도 레포트 항목으로 만드세요.
5. 최소 5개 이상 추출하세요.

섹터 id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
증권사 id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
JSON 배열로만 응답하세요.`;

    const userPrompt = `${content}\n\nJSON 배열:\n[\n  { "title": "리포트 제목", "source": "증권사id(samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other)", "sector": "섹터id(semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other)", "analyst": "애널리스트명", "summary": "핵심논점+데이터+투자의견+목표가+결론을 빠짐없이. 요약하지말고 정리. 10문장 이상 가능.", "stocks": "관련종목(쉼표구분)", "target_price": "목표가", "opinion": "매수/중립/매도", "rating": 3, "date": "${new Date().toISOString().slice(0,10)}" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const reports = JSON.parse(cleaned);

    return res.status(200).json({ success: true, reports, count: reports.length });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: e.message });
  }
}
