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
    const { data: digests, error } = await supabase
      .from('telegram_digests')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(3);

    if (error || !digests || digests.length === 0)
      return res.status(400).json({ error: '수집된 데이터가 없습니다. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });

    // 1순위: 레포트 텍스트
    const allReports = [];
    for (const d of digests) {
      for (const r of (d.report_texts || [])) allReports.push(r);
    }

    // 2순위: 메시지에서 레포트/리서치 관련 내용 추출
    const reportMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          const t = msg.text;
          // 레포트 관련 키워드 매칭 (넓게)
          if (t.includes('리포트') || t.includes('보고서') || t.includes('레포트') ||
              t.includes('목표가') || t.includes('투자의견') || t.includes('BUY') || t.includes('SELL') ||
              t.includes('매수') || t.includes('매도') || t.includes('비중확대') || t.includes('중립') ||
              t.includes('상향') || t.includes('하향') || t.includes('커버리지') ||
              t.includes('TP ') || t.includes('영업이익') || t.includes('컨센서스') ||
              t.includes('.pdf') || t.includes('PDF')) {
            reportMessages.push(`[${handle}] ${t.slice(0, 1000)}`);
          }
        }
      }
    }

    if (allReports.length === 0 && reportMessages.length === 0) {
      return res.status(200).json({ success: true, reports: [], count: 0, debug: 'No reports or report-related messages found in last 3 digests. digest_count=' + (digests?.length || 0) });
    }

    const content = [
      `=== PDF 레포트 (${allReports.length}개) ===`,
      ...allReports.map(r => `[파일: ${r.fileName}]\n${r.text.slice(0, 1500)}`),
      `\n=== 채널 내 레포트/투자의견 메시지 (${reportMessages.length}개) ===`,
      ...reportMessages.slice(0, 40),
    ].join('\n---\n').slice(0, 50000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다. 레포트 파일 정보와 텔레그램 메시지에서 증권사 리포트를 추출하여 정리합니다.

규칙:
- 텔레그램 메시지에 "목표가 상향", "투자의견 매수", "TP 25만" 등이 있으면 그것 자체가 리포트 요약입니다. 이것도 레포트 항목으로 만드세요.
- 섹터 id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
- 증권사 id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
- 가능한 많이 추출하세요 (최소 5개)
- JSON 배열로만 응답하세요`;

    const userPrompt = `아래 레포트+메시지에서 증권사 리포트를 정리하세요:\n\n${content}\n\nJSON 배열:\n[\n  { "title": "레포트 제목 또는 핵심 내용", "source": "증권사id", "sector": "섹터id", "summary": "3~5문장 핵심 요약 (목표가, 투자의견, 실적 등 수치 포함)", "stocks": "관련종목(쉼표구분)", "rating": 3, "date": "${new Date().toISOString().slice(0,10)}" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const reports = JSON.parse(cleaned);

    return res.status(200).json({ success: true, reports, count: reports.length });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: e.message });
  }
}
