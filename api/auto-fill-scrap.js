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

    // 1순위: 기사 원문 (있으면)
    const allArticles = [];
    for (const d of digests) {
      for (const a of (d.article_bodies || [])) {
        if (a.url && !allArticles.find(x => x.url === a.url)) allArticles.push(a);
      }
    }

    // 2순위: 텔레그램 메시지 (항상 있음 — 이게 핵심 소스)
    const allMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) allMessages.push({ handle, text: msg.text, urls: msg.urls || [] });
      }
    }

    if (allMessages.length === 0 && allArticles.length === 0) {
      return res.status(400).json({ error: '수집된 메시지가 없습니다. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });
    }

    // 메시지에서 뉴스성 내용 추출 (대부분의 텔레그램 채널이 뉴스 요약을 직접 올림)
    const newsMessages = allMessages
      .filter(m => m.text.length > 50) // 짧은 인사말 등 제외
      .map(m => `[${m.handle}] ${m.text.slice(0, 1000)}${m.urls.length > 0 ? '\nURL: ' + m.urls[0] : ''}`)
      .slice(0, 50);

    const articleTexts = allArticles.slice(0, 15).map(a => `[기사원문: ${a.title}]\nURL: ${a.url}\n${a.body.slice(0, 1500)}`);

    const content = [
      `=== 텔레그램 채널 메시지 (${newsMessages.length}개) ===`,
      ...newsMessages,
      articleTexts.length > 0 ? `\n=== 기사 원문 (${articleTexts.length}개) ===` : '',
      ...articleTexts,
    ].filter(Boolean).join('\n---\n').slice(0, 60000);

    const systemPrompt = `당신은 금융 뉴스 편집자입니다. 텔레그램 채널 메시지와 기사를 분석하여 신문스크랩을 만듭니다.

규칙:
- 텔레그램 메시지 자체가 뉴스 요약인 경우가 많습니다. 이것도 스크랩으로 만드세요.
- 카테고리: securities(증권)/economy(경제)/it(IT)/industry(산업)/realestate(부동산)/crypto(가상화폐)/other(기타)
- 요약은 3~5문장, 핵심 수치와 시장 영향 포함
- 최소 10개, 가능하면 15~20개 스크랩을 만드세요
- 같은 내용 중복은 제거하세요
- JSON 배열로만 응답하세요`;

    const userPrompt = `아래 텔레그램 메시지와 기사를 신문스크랩으로 정리하세요:\n\n${content}\n\nJSON 배열:\n[\n  { "title": "제목 (한줄로 핵심 요약)", "url": "URL 있으면 포함, 없으면 빈문자열", "category": "카테고리id", "summary": "3~5문장 상세 요약 (수치 포함)", "source": "auto", "channel": "텔레그램채널명" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 5000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const scraps = JSON.parse(cleaned);

    return res.status(200).json({ success: true, scraps, count: scraps.length });
  } catch (e) {
    console.error('auto-fill-scrap error:', e);
    return res.status(500).json({ error: e.message });
  }
}
