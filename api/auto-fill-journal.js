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

async function getLatestDigest() {
  const { data } = await supabase.from('telegram_digests').select('*').order('collected_at', { ascending: false }).limit(1).single();
  return data;
}

export default async function handler(req, res) {
  try {
    const digest = await getLatestDigest();
    if (!digest) return res.status(400).json({ error: 'No digest data. Run telegram collection first.' });

    const { raw_messages, article_bodies, report_texts, yahoo_snapshot } = digest;

    // 전체 메시지 합치기
    const allMessages = [];
    for (const [handle, msgs] of Object.entries(raw_messages || {})) {
      for (const msg of msgs) allMessages.push(`[${handle}] ${msg.text.slice(0, 800)}`);
    }

    // 기사 원문 합치기
    const articleTexts = (article_bodies || []).map(a => `[기사: ${a.title}]\n${a.body.slice(0, 1000)}`);

    // 레포트 합치기
    const reportTextsList = (report_texts || []).map(r => `[레포트: ${r.fileName}]\n${r.text.slice(0, 800)}`);

    const allContent = [
      '=== 텔레그램 메시지 ===', ...allMessages.slice(0, 50),
      '\n=== 기사 원문 ===', ...articleTexts.slice(0, 15),
      '\n=== 레포트 ===', ...reportTextsList.slice(0, 5),
    ].join('\n').slice(0, 80000);

    const yahooStr = JSON.stringify(yahoo_snapshot || {}, null, 1);

    const systemPrompt = `당신은 투자 전문 애널리스트입니다. 수집된 텔레그램 메시지, 기사, 레포트를 분석하여 투자일지 양식에 맞게 내용을 작성합니다.

핵심 규칙:
- 수집된 정보에 근거한 내용만 작성하세요.
- 수집된 정보로 채울 수 없는 항목은 빈 문자열("")로 두세요.
- 변동이유(reason)는 구체적 수치와 이벤트를 포함해 2~4문장.
- 전망(outlook)은 향후 방향성과 주시할 포인트 2~3문장.
- 반드시 아래 JSON 형식으로만 응답하세요.`;

    const userPrompt = `## 수치 데이터 (Yahoo Finance)
${yahooStr}

## 수집된 원본 정보
${allContent}

---

위 정보를 분석하여 아래 JSON을 작성하세요. 수집 정보가 없는 항목은 ""으로 두세요:

{
  "marketNotes": {
    "us": { "reason": "미국 증시 변동이유", "outlook": "미국 전망" },
    "kr": { "reason": "", "outlook": "" },
    "jp": { "reason": "", "outlook": "" },
    "cn": { "reason": "", "outlook": "" },
    "tw": { "reason": "", "outlook": "" }
  },
  "bondOutlook": "채권 시장 전망",
  "bondReasons": { "us10y": "미국 10년물 변동이유", "us2y": "", "kr10y": "", "kr3y": "" },
  "fxOutlook": "환율 전망",
  "commodityOutlook": "원자재 전망",
  "commodityReasons": { "gold": "금 변동이유", "oil": "", "btc": "", "eth": "" },
  "sectors": [
    { "name": "반도체", "change": "+2.1%", "reason": "변동이유", "outlook": "전망" }
  ],
  "stocks": [
    { "name": "SK하이닉스", "ticker": "000660", "price": "", "change": "", "reason": "변동이유", "outlook": "전망" }
  ],
  "memo": "오늘의 총평 1~2문장"
}`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json({ success: true, data: parsed });
  } catch (e) {
    console.error('auto-fill-journal error:', e);
    return res.status(500).json({ error: e.message });
  }
}
