import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════
// 텔레그램 공개 채널 스크래핑 (Bot API 불필요)
// t.me/s/채널명 → HTML 파싱 → 메시지 + URL 추출
// ═══════════════════════════════════════════════════

// 기본 채널 목록 (channels 테이블이 비어있을 때 fallback)
const DEFAULT_CHANNELS = [
  { handle: "ehdwl", name: "사제콩이_서상영", category: "시황" },
  { handle: "hedgecat0301", name: "키움증권 한지영", category: "시황" },
  { handle: "meritz_research", name: "메리츠증권 리서치", category: "시황" },
  { handle: "HANAStrategy", name: "하나증권 이재만", category: "시황" },
  { handle: "yeom_teacher", name: "염승환 이사", category: "시황" },
  { handle: "market_kis", name: "한투증권 김대준", category: "시황" },
  { handle: "moneycalendar", name: "머니캘린더", category: "뉴스" },
];

/**
 * t.me/s/채널명 에서 최근 메시지를 스크래핑
 * @returns {{ messages: Array, lastMsgId: number }}
 */
async function scrapeChannel(handle, afterMsgId = 0) {
  try {
    const url = `https://t.me/s/${handle}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    });
    if (!res.ok) return { messages: [], lastMsgId: afterMsgId };

    const html = await res.text();

    // 메시지 블록 추출 (data-post 속성으로 식별)
    const msgRegex = /data-post="([^"]+\/(\d+))"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const messages = [];
    let maxId = afterMsgId;
    let match;

    while ((match = msgRegex.exec(html)) !== null) {
      const msgId = parseInt(match[2]);
      if (msgId <= afterMsgId) continue; // 이미 수집한 메시지 스킵

      const rawText = match[3]
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();

      if (!rawText || rawText.length < 10) continue;

      // URL 추출
      const urlRegex = /https?:\/\/[^\s<"']+/g;
      const urls = (rawText.match(urlRegex) || []).filter(u =>
        !u.includes('t.me/') && !u.includes('telegram.') // 텔레그램 내부 링크 제외
      );

      messages.push({
        id: msgId,
        text: rawText.slice(0, 2000), // 최대 2000자
        urls,
        hasReport: rawText.includes('.pdf') || rawText.includes('리포트') || rawText.includes('보고서'),
      });

      if (msgId > maxId) maxId = msgId;
    }

    return { messages, lastMsgId: maxId };
  } catch (e) {
    console.error(`Scrape error [${handle}]:`, e.message);
    return { messages: [], lastMsgId: afterMsgId };
  }
}

/**
 * 기사 URL 본문 스크래핑 (간략)
 */
async function scrapeArticle(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // 기본적인 본문 추출 (og:title + <p> 태그)
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';

    // <article> 또는 주요 <p> 태그에서 텍스트 추출
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    const bodyHtml = articleMatch ? articleMatch[1] : html;
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(bodyHtml)) !== null) {
      const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 30) paragraphs.push(text);
    }

    const body = paragraphs.slice(0, 10).join('\n').slice(0, 3000);
    return { title, body };
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════
// Gemini Flash — 메시지 분류 + 요약
// 무료 한도 내 사용 (250회/일)
// ═══════════════════════════════════════════════════

async function callGemini(prompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    return null;
  }
}

/**
 * 채널별 메시지를 시장별로 분류 + 요약
 */
async function summarizeMessages(channelMessages) {
  // 모든 채널의 메시지를 합침
  const allTexts = [];
  for (const [handle, msgs] of Object.entries(channelMessages)) {
    for (const msg of msgs) {
      allTexts.push(`[${handle}] ${msg.text.slice(0, 500)}`);
    }
  }

  if (allTexts.length === 0) return {};

  const combined = allTexts.join('\n---\n').slice(0, 12000); // Gemini 입력 제한 고려

  const prompt = `당신은 금융 애널리스트입니다. 아래 텔레그램 채널 메시지들을 시장별로 분류하고 핵심 내용을 요약해주세요.

메시지:
${combined}

아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만:
{
  "us": { "summary": "미국 시장 요약 (2~3문장)", "key_events": ["이벤트1", "이벤트2"], "sources": ["채널핸들1"] },
  "kr": { "summary": "한국 시장 요약", "key_events": [], "sources": [] },
  "jp": { "summary": "일본 시장 요약", "key_events": [], "sources": [] },
  "cn": { "summary": "중국 시장 요약", "key_events": [], "sources": [] },
  "tw": { "summary": "대만 시장 요약", "key_events": [], "sources": [] },
  "bonds": { "summary": "채권/금리 요약", "key_events": [], "sources": [] },
  "fx": { "summary": "환율 요약", "key_events": [], "sources": [] },
  "commodities": { "summary": "원자재/유가 요약", "key_events": [], "sources": [] },
  "sectors": { "summary": "섹터별 주요 이슈", "key_events": [], "sources": [] }
}

해당 시장에 대한 메시지가 없으면 summary를 빈 문자열로 두세요.`;

  const result = await callGemini(prompt, 2000);
  if (!result) return {};

  try {
    // JSON 추출 (백틱 제거)
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {};
  }
}

/**
 * 기사 본문 AI 요약
 */
async function summarizeArticle(title, body, channel) {
  if (!body || body.length < 50) return null;

  const prompt = `아래 금융 기사를 3문장 이내로 요약하세요. 핵심 수치와 시장 영향을 포함하세요.

제목: ${title}
본문: ${body.slice(0, 2000)}

JSON으로만 응답: { "title": "${title}", "summary": "요약 3문장", "category": "카테고리(증권/경제/IT/산업/부동산/가상화폐/기타 중 하나)" }`;

  const result = await callGemini(prompt, 500);
  if (!result) return null;

  try {
    const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, channel, url: '' };
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════
// API Handler
// cron: 매일 09:00 / 19:30 KST (vercel.json)
// 수동: 투자일지 "📡 최신 데이터 가져오기" 버튼
//       포트폴리오 "🔄 데이터 수집 + AI 분석" 버튼
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const runType = req.query?.type || 'cron'; // "cron" | "manual"
    const timestamp = new Date().toISOString();
    const dateKey = timestamp.slice(0, 10);

    // ── 1. 채널 목록 가져오기 ──
    let channels = DEFAULT_CHANNELS;
    try {
      const { data } = await supabase
        .from('channels')
        .select('handle, name, category, enabled')
        .eq('enabled', true);
      if (data && data.length > 0) {
        channels = data;
      }
    } catch (e) {}

    // ── 2. 이전 수집의 last_msg_ids 가져오기 (증분 수집) ──
    let prevMsgIds = {};
    try {
      const { data } = await supabase
        .from('telegram_digests')
        .select('last_msg_ids')
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();
      if (data?.last_msg_ids) prevMsgIds = data.last_msg_ids;
    } catch (e) {}

    // ── 3. 채널별 스크래핑 (순차, 300ms 간격) ──
    const rawMessages = {};
    const newMsgIds = { ...prevMsgIds };
    let totalMessages = 0;
    const allUrls = [];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const afterId = prevMsgIds[ch.handle] || 0;
      const { messages, lastMsgId } = await scrapeChannel(ch.handle, afterId);

      if (messages.length > 0) {
        rawMessages[ch.handle] = messages;
        totalMessages += messages.length;

        // URL 수집
        for (const msg of messages) {
          for (const url of msg.urls) {
            allUrls.push({ url, channel: ch.handle, category: ch.category });
          }
        }
      }

      newMsgIds[ch.handle] = Math.max(lastMsgId, afterId);

      // rate limiting
      if (i < channels.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // ── 4. 기사 본문 스크래핑 + AI 요약 (최대 10개) ──
    const articleSummaries = [];
    const urlsToScrape = allUrls.slice(0, 10); // 비용/시간 제한

    for (const item of urlsToScrape) {
      const article = await scrapeArticle(item.url);
      if (article && article.body) {
        const summary = await summarizeArticle(article.title, article.body, item.channel);
        if (summary) {
          articleSummaries.push({ ...summary, url: item.url });
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ── 5. 메시지 시장별 분류 + 요약 (Gemini) ──
    let marketSummaries = {};
    if (totalMessages > 0) {
      marketSummaries = await summarizeMessages(rawMessages);
    }

    // ── 6. Supabase 저장 ──
    const stats = {
      total_messages: totalMessages,
      total_urls: allUrls.length,
      total_reports: allUrls.filter(u => u.url.includes('.pdf')).length,
      channels_collected: Object.keys(rawMessages).length,
      channels_total: channels.length,
    };

    const { error } = await supabase
      .from('telegram_digests')
      .insert({
        date_key: dateKey,
        raw_messages: rawMessages,
        last_msg_ids: newMsgIds,
        article_summaries: articleSummaries,
        report_summaries: [], // PDF 분석은 추후 구현
        market_summaries: marketSummaries,
        stats,
        run_type: runType,
      });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      runType,
      date: dateKey,
      stats,
      markets: Object.keys(marketSummaries).filter(k => marketSummaries[k]?.summary),
      articles: articleSummaries.length,
    });

  } catch (e) {
    console.error('telegram-digest error:', e);
    return res.status(500).json({ error: e.message });
  }
}
