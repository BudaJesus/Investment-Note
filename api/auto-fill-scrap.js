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
    const { data: digest } = await supabase.from('telegram_digests').select('article_bodies, raw_messages, collected_at')
      .order('collected_at', { ascending: false }).limit(1).single();
    if (!digest) return res.status(400).json({ error: 'No digest data' });

    const articles = digest.article_bodies || [];
    if (articles.length === 0) return res.status(200).json({ success: true, scraps: [], message: 'No articles to process' });

    const articleTexts = articles.map((a, i) => `[${i+1}] 제목: ${a.title}\nURL: ${a.url}\n본문: ${a.body.slice(0, 1500)}`).join('\n---\n');

    const systemPrompt = `당신은 금융 뉴스 편집자입니다. 기사 원문을 분석하여 신문스크랩 형식으로 정리합니다.
카테고리: 증권/은행/경제/부동산/IT/산업/가상화폐/기타 중 하나.
요약은 3~5문장, 핵심 수치와 시장 영향을 반드시 포함.
JSON 배열로만 응답하세요.`;

    const userPrompt = `아래 ${articles.length}개 기사를 스크랩 형식으로 정리하세요:

${articleTexts}

JSON 배열로 응답:
[
  {
    "title": "기사 제목",
    "url": "원본 URL",
    "category": "카테고리",
    "summary": "3~5문장 요약",
    "source": "auto"
  }
]`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const scraps = JSON.parse(cleaned);

    return res.status(200).json({ success: true, scraps });
  } catch (e) {
    console.error('auto-fill-scrap error:', e);
    return res.status(500).json({ error: e.message });
  }
}
