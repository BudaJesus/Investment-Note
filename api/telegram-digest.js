import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// ═══════════════════════════════════════════════════
// Gemini Flash — PDF 원본 텍스트를 정리 (요약 아님!)
// 중복/군더더기만 삭제, 핵심 데이터는 전부 유지
// ═══════════════════════════════════════════════════
async function organizeWithGemini(rawText, fileName) {
  if (!GEMINI_KEY || rawText.length < 200) return rawText;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `아래는 증권사 리포트 "${fileName}"의 전체 텍스트입니다.

## 작업: 정리 (요약 아님!)

절대 규칙:
1. 요약하지 마세요. 핵심 내용을 빠뜨리면 안 됩니다.
2. 수치(가격, %, 금액, 날짜, 목표가, PER, 영업이익)는 하나도 빠뜨리지 말고 전부 포함하세요.
3. 투자의견, 목표가, 애널리스트명, 증권사명은 반드시 포함하세요.
4. 표/데이터가 있으면 구조를 유지하세요.
5. 삭제해도 되는 것: 중복된 문장, 같은 말 반복, 법적 고지사항, 페이지 번호, 머리글/바닥글, 회사 주소/연락처, 준법감시 문구.
6. 삭제하면 안 되는 것: 모든 수치, 모든 분석 내용, 모든 전망, 모든 데이터, 차트 설명.

정리 형식:
■ 레포트 기본정보
증권사: / 애널리스트: / 발행일: / 투자의견: / 목표가:

■ 핵심 논점
(원본의 핵심 주장들을 빠짐없이, 수치 포함)

■ 데이터/수치
(원본에 있는 모든 수치, 표, 전망치를 구조화)

■ 산업/시장 분석
(원본의 산업/시장 관련 내용)

■ 리스크
(원본에 언급된 리스크 전부)

■ 결론/전망
(원본의 결론 부분)

없는 섹션은 생략하세요. 섹션 내에서는 원본 표현을 최대한 살리세요.

=== 레포트 원문 ===
${rawText}` }] }],
          generationConfig: { maxOutputTokens: 8000, temperature: 0.1 },
        }),
      }
    );
    if (!res.ok) return rawText.slice(0, 15000);
    const data = await res.json();
    const organized = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (organized && organized.length > 100) {
      console.log(`Gemini organized: ${fileName} (${rawText.length} → ${organized.length} chars)`);
      return organized;
    }
    return rawText.slice(0, 15000);
  } catch (e) {
    console.error('Gemini organize error:', e.message);
    return rawText.slice(0, 15000); // fallback: 앞 15000자
  }
}

// ═══════════════════════════════════════════════════
// 텔레그램 정보 수집
// 메시지/기사: AI 없음, 원본 그대로 저장
// PDF 레포트: Gemini Flash(무료)로 정리 후 저장
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

// ─── PDF 레포트 다운로드 + 텍스트 추출 (Bot API) ───
// JINO의 비공개 채널에서 포워딩된 PDF를 다운로드하고 텍스트를 추출
const PRIVATE_CHANNEL_ID = process.env.REPORT_CHANNEL_ID || '-1003884768252';

async function fetchReportTexts() {
  const reports = [];

  // ── Part 1: Bot API로 비공개 채널의 PDF 다운로드 + 텍스트 추출 ──
  if (BOT_TOKEN) {
    try {
      // 최근 메시지 가져오기 (getUpdates는 100개 제한이라 직접 채널 메시지 조회)
      // forwardMessage나 getChat은 채널 멤버여야 작동
      // Bot API에는 "채널 메시지 목록 조회" API가 없으므로 getUpdates 사용
      const updatesRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-50&limit=50`);
      if (updatesRes.ok) {
        const updatesData = await updatesRes.json();
        const updates = updatesData.result || [];
        
        for (const update of updates) {
          const msg = update.channel_post || update.message;
          if (!msg) continue;
          
          // 문서(PDF) 파일이 있는 메시지
          if (msg.document) {
            const doc = msg.document;
            const fileName = doc.file_name || 'unknown.pdf';
            const caption = msg.caption || '';
            
            // PDF 파일만 처리
            if (fileName.toLowerCase().endsWith('.pdf') || doc.mime_type === 'application/pdf') {
              try {
                // Step 1: 파일 경로 가져오기
                const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${doc.file_id}`);
                if (!fileRes.ok) continue;
                const fileData = await fileRes.json();
                const filePath = fileData.result?.file_path;
                if (!filePath) continue;

                // Step 2: 파일 다운로드
                const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
                const pdfRes = await fetch(downloadUrl);
                if (!pdfRes.ok) continue;
                const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

                // Step 3: PDF 텍스트 추출 (전체)
                let pdfRawText = '';
                try {
                  const pdfParse = (await import('pdf-parse')).default;
                  const parsed = await pdfParse(pdfBuffer);
                  pdfRawText = parsed.text; // 전체 추출 (잘림 없음)
                } catch (parseErr) {
                  pdfRawText = `[PDF 파싱 실패: ${parseErr.message}]`;
                }

                // Step 4: Gemini Flash로 정리 (무료, 요약 아님!)
                // 중복/군더더기만 삭제, 수치/데이터/핵심내용 전부 유지
                const organizedText = await organizeWithGemini(pdfRawText, fileName);

                reports.push({
                  msgId: msg.message_id,
                  fileName,
                  channel: 'bot_private',
                  text: `[PDF 레포트: ${fileName}]\n캡션: ${caption}\n\n${organizedText}`,
                  extractedAt: new Date().toISOString(),
                  source: 'pdf',
                  rawLength: pdfRawText.length,
                  organizedLength: organizedText.length,
                });

                console.log(`PDF processed: ${fileName} (원본 ${pdfRawText.length}자 → 정리 ${organizedText.length}자)`);
              } catch (dlErr) {
                console.error(`PDF download error [${fileName}]:`, dlErr.message);
              }
            }
          }
          
          // 텍스트 메시지 (이미지 캡션 포함)
          if (msg.text || msg.caption) {
            const text = msg.text || msg.caption || '';
            if (text.length > 20 && !msg.document) {
              reports.push({
                msgId: msg.message_id,
                fileName: text.slice(0, 80),
                channel: 'bot_private',
                text: `[리포트 메시지] ${text}`.slice(0, 3000),
                extractedAt: new Date().toISOString(),
                source: 'caption',
              });
            }
          }
          
          await new Promise(r => setTimeout(r, 100)); // rate limiting
        }
      }
    } catch (e) {
      console.error('Bot API report fetch error:', e.message);
    }
  }

  // ── Part 2: 공개 채널 웹 스크래핑 (캡션 텍스트) ──
  try {
    const res = await fetch(`https://t.me/s/${REPORT_CHANNEL}`, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      } 
    });
    if (res.ok) {
      const html = await res.text();
      const existingIds = new Set(reports.map(r => r.msgId));
      
      // 메시지 텍스트 추출
      const msgRegex = /data-post="[^"]*\/(\d+)"[\s\S]*?message_text[^>]*>([\s\S]*?)<\/div>/g;
      let match;
      while ((match = msgRegex.exec(html)) !== null) {
        const msgId = parseInt(match[1]);
        if (existingIds.has(msgId)) continue;
        const rawText = match[2].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
        if (rawText.length > 10) {
          reports.push({ msgId, fileName: rawText.slice(0, 80), channel: REPORT_CHANNEL, text: `[리포트갤러리] ${rawText}`.slice(0, 3000), extractedAt: new Date().toISOString(), source: 'web' });
          existingIds.add(msgId);
        }
      }
      
      // document_title 패턴
      const docRegex = /data-post="[^"]*\/(\d+)"[\s\S]*?document_title[^>]*>([^<]+)/g;
      let docMatch;
      while ((docMatch = docRegex.exec(html)) !== null) {
        const msgId = parseInt(docMatch[1]);
        if (existingIds.has(msgId)) continue;
        reports.push({ msgId, fileName: docMatch[2].trim(), channel: REPORT_CHANNEL, text: `[리포트갤러리] 파일: ${docMatch[2].trim()}`, extractedAt: new Date().toISOString(), source: 'web' });
      }
    }
  } catch (e) { console.error('Web scrape report error:', e.message); }

  console.log(`Reports collected: ${reports.length} (PDF: ${reports.filter(r => r.source === 'pdf').length}, caption: ${reports.filter(r => r.source === 'caption').length}, web: ${reports.filter(r => r.source === 'web').length})`);
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
    let prevReportNames = new Set();
    try {
      const { data } = await supabase.from('telegram_digests').select('last_msg_ids, article_bodies, report_texts')
        .order('collected_at', { ascending: false }).limit(1).single();
      if (data?.last_msg_ids) prevMsgIds = data.last_msg_ids;
      if (data?.article_bodies) for (const a of data.article_bodies) if (a.url) prevArticleUrls.add(a.url);
      if (data?.report_texts) for (const r of data.report_texts) if (r.fileName) prevReportNames.add(r.fileName);
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

    let reportTexts = await fetchReportTexts();
    // 이전 수집과 중복된 레포트 제거
    if (prevReportNames.size > 0) {
      const before = reportTexts.length;
      reportTexts = reportTexts.filter(r => !prevReportNames.has(r.fileName));
      if (before !== reportTexts.length) console.log(`Reports dedup: ${before} → ${reportTexts.length}`);
    }

    const stats = { total_messages: totalMessages, total_articles: articleBodies.length, total_reports: reportTexts.length, channels_collected: Object.keys(rawMessages).length, yahoo_symbols: Object.keys(yahooSnapshot).length };

    // 같은 날짜+runType이면 덮어쓰기 (중복 방지)
    // 먼저 기존 행 확인
    const { data: existing } = await supabase.from('telegram_digests')
      .select('id, report_texts, article_bodies')
      .eq('date_key', dateKey).eq('run_type', runType).limit(1).single();

    if (existing) {
      // 기존 레포트/기사와 합치기 (새 것만 추가)
      const mergedReports = [...(existing.report_texts || [])];
      const existingNames = new Set(mergedReports.map(r => r.fileName));
      for (const r of reportTexts) {
        if (!existingNames.has(r.fileName)) mergedReports.push(r);
      }
      const mergedArticles = [...(existing.article_bodies || [])];
      const existingUrls = new Set(mergedArticles.map(a => a.url));
      for (const a of articleBodies) {
        if (a.url && !existingUrls.has(a.url)) mergedArticles.push(a);
      }
      stats.total_reports = mergedReports.length;
      stats.total_articles = mergedArticles.length;

      const { error } = await supabase.from('telegram_digests')
        .update({ raw_messages: rawMessages, last_msg_ids: newMsgIds, article_bodies: mergedArticles, report_texts: mergedReports, yahoo_snapshot: yahooSnapshot, stats, collected_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await supabase.from('telegram_digests').insert({
        date_key: dateKey, raw_messages: rawMessages, last_msg_ids: newMsgIds,
        article_bodies: articleBodies, report_texts: reportTexts, yahoo_snapshot: yahooSnapshot,
        stats, run_type: runType,
      });
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true, runType, date: dateKey, stats });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
