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
    // 최근 3개 digest에서 기사 모으기 (하나만 보면 부족할 수 있음)
    const { data: digests, error } = await supabase
      .from('telegram_digests')
      .select('article_bodies, raw_messages, collected_at')
      .order('collected_at', { ascending: false })
      .limit(3);

    if (error) return res.status(500).json({ error: error.message });
    if (!digests || digests.length === 0) return res.status(400).json({ error: 'No digest data. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });

    // 모든 digest에서 기사 합치기
    const allArticles = [];
    const seenUrls = new Set();
    for (const d of digests) {
      for (const a of (d.article_bodies || [])) {
        if (a.url && !seenUrls.has(a.url)) { seenUrls.add(a.url); allArticles.push(a); }
      }
    }

    // 기사가 없으면 메시지에서 뉴스성 내용 추출
    const allMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) allMessages.push(`[${handle}] ${msg.text.slice(0, 600)}`);
      }
    }

    if (allArticles.length === 0 && allMessages.length === 0) {
      return res.status(400).json({ error: '수집된 기사와 메시지가 없습니다. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });
    }

    // 기사 원문 + 메시지(기사 없을 때 대체)
    let content = '';
    if (allArticles.length > 0) {
      content = allArticles.slice(0, 30).map((a, i) => `[${i+1}] 제목: ${a.title}\nURL: ${a.url}\n본문: ${a.body.slice(0, 1500)}`).join('\n---\n');
    } else {
      content = '기사 원문이 없어 텔레그램 메시지에서 뉴스성 내용을 추출합니다:\n' + allMessages.slice(0, 40).join('\n---\n');
    }

    const systemPrompt = `당신은 금융 뉴스 편집자입니다. 기사 원문 또는 텔레그램 메시지를 분석하여 신문스크랩 형식으로 정리합니다.
카테고리: securities(증권)/economy(경제)/it(IT)/industry(산업)/realestate(부동산)/crypto(가상화폐)/other(기타) 중 하나.
요약은 3~5문장, 핵심 수치와 시장 영향을 반드시 포함.
최소 10개 이상 스크랩을 만드세요.
JSON 배열로만 응답하세요.`;

    const userPrompt = `아래 ${allArticles.length}개 기사 + ${allMessages.length}개 메시지를 스크랩으로 정리하세요:\n\n${content.slice(0, 50000)}\n\nJSON 배열로 응답:\n[\n  { "title": "제목", "url": "원본URL 또는 빈문자열", "category": "카테고리id", "summary": "3~5문장 요약", "source": "auto" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 4000);
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const scraps = JSON.parse(cleaned);

    return res.status(200).json({ success: true, scraps, count: scraps.length });
  } catch (e) {
    console.error('auto-fill-scrap error:', e);
    return res.status(500).json({ error: e.message });
  }
}
