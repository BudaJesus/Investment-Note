import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ═══════════════════════════════════════════════════
// 텔레그램 정보 수집 — AI 없음, 원본 그대로 저장
// ═══════════════════════════════════════════════════

const DEFAULT_CHANNELS = [
  { handle: "ehdwl", name: "사제콩이_서상영", category: "시황" },
  { handle: "hedgecat0301", name: "키움증권 한지영", category: "시황" },
  { handle: "meritz_research", name: "메리츠증권 리서치", category: "시황" },
  { handle: "HANAStrategy", name: "하나증권 이재만", category: "시황" },
  { handle: "yeom_teacher", name: "염승환 이사", category: "시황" },
  { handle: "market_kis", name: "한투증권 김대준", category: "시황" },
  { handle: "moneycalendar", name: "머니캘린더", category: "뉴스" },
];

const REPORT_CHANNEL = "report_figure_by_offset";

// ─── Yahoo Finance 수치 ───
const YAHOO_SYMBOLS = {
  sp500: "^GSPC", nasdaq: "^IXIC", dow: "^DJI", russell: "^RUT", sox: "^SOX",
  nikkei: "^N225", topix: "^TOPX", kospi: "^KS11", kosdaq: "^KQ11",
  shanghai: "000001.SS", shenzhen: "399001.SZ", hang: "^HSI", taiex: "^TWII",
  us10y: "^TNX", gold: "GC=F", silver: "SI=F", oil: "CL=F", natgas: "NG=F",
  btc: "BTC-USD", eth: "ETH-USD", usdkrw: "KRW=X", usdjpy: "JPY=X", dxy: "DX-Y.NYB",
};

async function fetchYahooSnapshot() {
  const results = {};
  const entries = Object.entries(YAHOO_SYMBOLS);
  for (let i = 0; i < entries.length; i += 5) {
    const batch = entries.slice(i, i + 5);
    await Promise.all(batch.map(async ([id, symbol]) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          const chg = prev ? (((price - prev) / prev) * 100).toFixed(2) : null;
          results[id] = { price: price.toFixed(2), change: chg ? (chg > 0 ? `+${chg}%` : `${chg}%`) : null };
        }
      } catch (e) {}
    }));
  }
  return results;
}

// ─── 텔레그램 채널 스크래핑 ───
async function scrapeChannel(handle, afterMsgId = 0) {
  try {
    const res = await fetch(`https://t.me/s/${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return { messages: [], lastMsgId: afterMsgId };
    const html = await res.text();
    const msgRegex = /data-post="([^"]+\/(\d+))"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const messages = [];
    let maxId = afterMsgId;
    let match;
    while ((match = msgRegex.exec(html)) !== null) {
      const msgId = parseInt(match[2]);
      if (msgId <= afterMsgId) continue;
      const rawText = match[3].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
      if (!rawText || rawText.length < 10) continue;
      const urlRegex = /https?:\/\/[^\s<"']+/g;
      const urls = (rawText.match(urlRegex) || []).filter(u => !u.includes('t.me/') && !u.includes('telegram.'));
      messages.push({ id: msgId, text: rawText, urls });
      if (msgId > maxId) maxId = msgId;
    }
    return { messages, lastMsgId: maxId };
  } catch (e) { return { messages: [], lastMsgId: afterMsgId }; }
}

// ─── 기사 원문 스크래핑 (요약 없이) ───
async function scrapeArticle(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    const html = await res.text();
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
    const bodyHtml = articleMatch ? articleMatch[1] : html;
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(bodyHtml)) !== null) {
      const text = pMatch[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 20) paragraphs.push(text);
    }
    const body = paragraphs.slice(0, 20).join('\n');
    if (body.length < 50) return null;
    return { url, title, body: body.slice(0, 5000) };
  } catch (e) { return null; }
}

// ─── PDF 레포트 텍스트 추출 (웹 스크래핑) ───
async function fetchReportTexts() {
  const reports = [];
  try {
    const res = await fetch(`https://t.me/s/${REPORT_CHANNEL}`, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      } 
    });
    if (!res.ok) { console.error('Report channel fetch failed:', res.status); return []; }
    const html = await res.text();

    // 메시지 블록 단위로 분할 (여러 패턴 시도)
    const blocks = html.split(/tgme_widget_message_wrap|js-widget_message_wrap/);
    
    for (const block of blocks.slice(1)) { // 첫 블록은 헤더
      const idMatch = block.match(/data-post="[^\/]*\/(\d+)"/);
      const msgId = idMatch ? parseInt(idMatch[1]) : 0;
      
      // 패턴 1: document_title 클래스
      const titleMatch = block.match(/document_title[^>]*>([^<]+)/);
      // 패턴 2: document 태그 내 파일 설명
      const docMatch = block.match(/document_extra[^>]*>([^<]+)/);
      // 패턴 3: 메시지 텍스트
      const textMatch = block.match(/message_text[^>]*>([\s\S]*?)<\/div>/);
      // 패턴 4: 파일 크기 정보
      const sizeMatch = block.match(/document_size[^>]*>([^<]+)/);

      const fileName = titleMatch ? titleMatch[1].trim() : '';
      const docInfo = docMatch ? docMatch[1].trim() : '';
      const msgText = textMatch ? textMatch[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim() : '';
      const fileSize = sizeMatch ? sizeMatch[1].trim() : '';

      // 파일이 있거나 리포트 관련 텍스트가 있으면 수집
      if (fileName || (msgText && (msgText.includes('.pdf') || msgText.includes('리포트') || msgText.includes('보고서')))) {
        const displayName = fileName || (msgText.slice(0, 60) + '...');
        reports.push({
          msgId,
          fileName: displayName,
          fileSize,
          channel: REPORT_CHANNEL,
          text: `[레포트: ${displayName}]${fileSize ? ` (${fileSize})` : ''}\n${msgText}`.slice(0, 3000),
          extractedAt: new Date().toISOString(),
        });
      }
    }
    
    console.log(`Report channel: ${blocks.length - 1} messages scanned, ${reports.length} reports found`);
  } catch (e) { console.error('Report fetch error:', e.message); }
  return reports;
}

// ═══ API Handler ═══
export default async function handler(req, res) {
  try {
    const runType = req.query?.type || 'cron';
    const timestamp = new Date().toISOString();
    const dateKey = timestamp.slice(0, 10);

    let channels = DEFAULT_CHANNELS;
    try {
      const { data } = await supabase.from('channels').select('handle, name, category, enabled').eq('enabled', true);
      if (data && data.length > 0) channels = data;
    } catch (e) {}

    let prevMsgIds = {};
    let prevArticleUrls = new Set();
    try {
      const { data } = await supabase.from('telegram_digests').select('last_msg_ids, article_bodies')
        .order('collected_at', { ascending: false }).limit(1).single();
      if (data?.last_msg_ids) prevMsgIds = data.last_msg_ids;
      if (data?.article_bodies) for (const a of data.article_bodies) if (a.url) prevArticleUrls.add(a.url);
    } catch (e) {}

    const yahooSnapshot = await fetchYahooSnapshot();

    const rawMessages = {};
    const newMsgIds = { ...prevMsgIds };
    let totalMessages = 0;
    const allUrls = [];

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const { messages, lastMsgId } = await scrapeChannel(ch.handle, prevMsgIds[ch.handle] || 0);
      if (messages.length > 0) {
        rawMessages[ch.handle] = messages;
        totalMessages += messages.length;
        for (const msg of messages) for (const url of msg.urls) if (!prevArticleUrls.has(url)) allUrls.push(url);
      }
      newMsgIds[ch.handle] = Math.max(lastMsgId, prevMsgIds[ch.handle] || 0);
      if (i < channels.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    const uniqueUrls = [...new Set(allUrls)].slice(0, 30);
    const articleBodies = [];
    for (const url of uniqueUrls) {
      const article = await scrapeArticle(url);
      if (article) articleBodies.push(article);
      await new Promise(r => setTimeout(r, 200));
    }

    const reportTexts = await fetchReportTexts();

    const stats = { total_messages: totalMessages, total_articles: articleBodies.length, total_reports: reportTexts.length, channels_collected: Object.keys(rawMessages).length, yahoo_symbols: Object.keys(yahooSnapshot).length };

    const { error } = await supabase.from('telegram_digests').insert({
      date_key: dateKey, raw_messages: rawMessages, last_msg_ids: newMsgIds,
      article_bodies: articleBodies, report_texts: reportTexts, yahoo_snapshot: yahooSnapshot,
      stats, run_type: runType,
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, runType, date: dateKey, stats });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
