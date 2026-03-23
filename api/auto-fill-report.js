import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callClaude(systemPrompt, userPrompt, maxTokens = 3000) {
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
    const { data: digest } = await supabase.from('telegram_digests').select('report_texts, raw_messages, collected_at')
      .order('collected_at', { ascending: false }).limit(1).single();
    if (!digest) return res.status(400).json({ error: 'No digest data' });

    // 레포트 텍스트 + 메시지 내 레포트 언급 합치기
    const reportTexts = digest.report_texts || [];
    const allMessages = [];
    for (const [handle, msgs] of Object.entries(digest.raw_messages || {})) {
      for (const msg of msgs) {
        if (msg.text.includes('리포트') || msg.text.includes('보고서') || msg.text.includes('레포트') || msg.text.includes('.pdf'))
          allMessages.push(`[${handle}] ${msg.text.slice(0, 600)}`);
      }
    }

    if (reportTexts.length === 0 && allMessages.length === 0)
      return res.status(200).json({ success: true, reports: [], message: 'No reports found' });

    const content = [
      '=== PDF 레포트 ===',
      ...reportTexts.map(r => `파일: ${r.fileName}\n${r.text.slice(0, 1000)}`),
      '\n=== 채널 내 레포트 관련 메시지 ===',
      ...allMessages.slice(0, 20),
    ].join('\n---\n').slice(0, 40000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다. 레포트 텍스트와 관련 메시지를 분석하여 레포트 아카이브 형식으로 정리합니다.
섹터: 반도체/2차전지/바이오/자동차/IT/금융/에너지/소비재/산업재/부동산/매크로/기타 중 하나.
증권사: 삼성/미래에셋/KB/NH/하나/신한/키움/대신/한화/메리츠/기타 중 하나.
JSON 배열로만 응답하세요.`;

    const userPrompt = `아래 레포트 정보를 정리하세요:

${content}

JSON 배열로 응답:
[
  {
    "title": "레포트 제목",
    "source": "증권사 id (samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/other)",
    "sector": "섹터 id (semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other)",
    "summary": "3~5문장 핵심 요약",
    "stocks": "관련 종목 (쉼표 구분)",
    "rating": 3,
    "date": "${new Date().toISOString().slice(0,10)}"
  }
]`;

    const result = await callClaude(systemPrompt, userPrompt, 3000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const reports = JSON.parse(cleaned);

    return res.status(200).json({ success: true, reports });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: e.message });
  }
}
