import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callGemini(prompt, maxTokens = 5000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export default async function handler(req, res) {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: digests, error } = await supabase.from('telegram_digests')
      .select('article_bodies, raw_messages, date_key')
      .gte('collected_at', sevenDaysAgo.toISOString())
      .order('collected_at', { ascending: true }).limit(10);

    if (error || !digests?.length)
      return res.status(400).json({ error: '수집된 데이터가 없습니다.' });

    const allArticles = [];
    const seenUrls = new Set();
    for (const d of digests) {
      for (const a of (d.article_bodies || [])) {
        if (a.url && seenUrls.has(a.url)) continue;
        if (a.url) seenUrls.add(a.url);
        allArticles.push(a);
      }
    }

    const newsMessages = [];
    const seenKeys = new Set();
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          const key = `${handle}_${msg.id}`;
          if (seenKeys.has(key) || msg.text.length < 50) continue;
          seenKeys.add(key);
          newsMessages.push(`[${d.date_key || ''}][${handle}] ${msg.text.slice(0, 800)}${msg.urls?.length > 0 ? '\nURL: ' + msg.urls[0] : ''}`);
        }
      }
    }

    if (newsMessages.length === 0 && allArticles.length === 0) {
      return res.status(200).json({ success: true, scraps: [], debug: 'No messages or articles' });
    }

    const content = [
      `=== 텔레그램 메시지 (${newsMessages.length}개, 7일치) ===`,
      ...newsMessages.slice(-40),
      allArticles.length > 0 ? `\n=== 기사 원문 (${allArticles.length}개) ===` : '',
      ...allArticles.slice(0, 10).map(a => `[기사: ${a.title}]\nURL: ${a.url}\n${a.body.slice(0, 1200)}`),
    ].filter(Boolean).join('\n---\n').slice(0, 30000);

    const fullPrompt = `당신은 금융 뉴스 편집자입니다. 텔레그램 채널 메시지와 기사를 분석하여 신문스크랩을 만듭니다.

규칙:
- 텔레그램 메시지 자체가 뉴스 요약인 경우가 많습니다. 이것도 스크랩으로 만드세요.
- 카테고리: securities(증권)/economy(경제)/it(IT)/industry(산업)/realestate(부동산)/crypto(가상화폐)/other(기타)
- 요약은 3~5문장, 핵심 수치와 시장 영향 포함
- 최소 20개, 가능하면 25~30개 스크랩을 만드세요
- 같은 내용 중복은 제거하세요
- summary 안에 큰따옴표를 쓰지 마세요. 작은따옴표를 사용하세요.
- JSON 배열로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요.

${content}

JSON 배열:
[
  { "title": "제목 (한줄 핵심요약)", "url": "URL 있으면 포함, 없으면 빈문자열", "category": "카테고리id", "summary": "3~5문장 상세 요약 (수치 포함)", "source": "auto", "channel": "채널명" }
]`;

    const result = await callGemini(fullPrompt, 5000);
    let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let scraps;
    try { scraps = JSON.parse(cleaned); } catch (e1) {
      try {
        const s = cleaned.indexOf('['), e = cleaned.lastIndexOf(']');
        if (s >= 0 && e > s) scraps = JSON.parse(cleaned.slice(s, e + 1));
        else throw new Error('No array');
      } catch (e2) {
        return res.status(500).json({ error: 'JSON 파싱 실패', raw: cleaned.slice(0, 300) });
      }
    }

    if (!Array.isArray(scraps)) scraps = [];
    scraps = scraps.filter(s => s && typeof s === 'object').map(s => ({
      title: String(s.title || ''), url: String(s.url || ''), category: String(s.category || 'other'),
      summary: String(s.summary || ''), source: 'auto', channel: String(s.channel || ''),
    }));

    return res.status(200).json({ success: true, scraps, count: scraps.length });
  } catch (e) {
    console.error('auto-fill-scrap error:', e);
    return res.status(500).json({ error: e.message });
  }
}
