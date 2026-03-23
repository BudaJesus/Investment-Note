import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function callClaude(systemPrompt, userPrompt, maxTokens = 8000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

async function gatherData() {
  const result = { yahooData: {}, investingData: {}, digests: [], feedback: null };
  // 1. auto_data (최신 시장 수치)
  try {
    const { data } = await supabase.from('auto_data').select('yahoo_data, investing_data').order('date_key', { ascending: false }).limit(1).single();
    if (data) { result.yahooData = data.yahoo_data || {}; result.investingData = data.investing_data || {}; }
  } catch (e) {}
  // 2. telegram_digests — 최근 3일치 (raw_messages가 크므로 적게)
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const { data } = await supabase.from('telegram_digests')
      .select('raw_messages, article_bodies, yahoo_snapshot, date_key')
      .gte('collected_at', threeDaysAgo.toISOString())
      .order('collected_at', { ascending: false }) // 최신부터
      .limit(5);
    if (data) result.digests = data.reverse(); // 시간순으로 뒤집기
  } catch (e) {}
  // 2-1. 레포트는 14일치 별도 (report_texts만, 가벼움)
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const { data } = await supabase.from('telegram_digests')
      .select('report_texts, date_key')
      .gte('collected_at', fourteenDaysAgo.toISOString())
      .order('collected_at', { ascending: true })
      .limit(15);
    if (data) result.reportDigests = data;
  } catch (e) {}
  // 3. 피드백 루프
  try {
    const { data } = await supabase.from('feedback_prompts').select('prompt_injection, hit_rates').order('generated_at', { ascending: false }).limit(1).single();
    if (data) result.feedback = data;
  } catch (e) {}
  return result;
}

/**
 * 여러 digest를 시간순으로 합치기
 * 최신 정보가 뒤에 오므로 Claude가 자연스럽게 최신에 가중치를 둠
 */
function mergeDigests(digests, reportDigests = []) {
  const allMessages = [];
  const allArticles = [];
  const allReports = [];
  let latestYahoo = {};
  const seenMsgIds = new Set();
  const seenUrls = new Set();
  const seenReportIds = new Set();

  for (const digest of digests) {
    const dateLabel = digest.date_key || digest.collected_at?.slice(0, 10) || '';
    // Yahoo — 최신 것으로 계속 덮어씀
    if (digest.yahoo_snapshot && Object.keys(digest.yahoo_snapshot).length > 0) {
      latestYahoo = { ...latestYahoo, ...digest.yahoo_snapshot };
    }
    // 메시지 — 중복 제거 (같은 채널+msgId)
    for (const [handle, msgs] of Object.entries(digest.raw_messages || {})) {
      for (const msg of msgs) {
        const key = `${handle}_${msg.id}`;
        if (seenMsgIds.has(key)) continue;
        seenMsgIds.add(key);
        allMessages.push({ date: dateLabel, handle, text: msg.text });
      }
    }
    // 기사 — URL 기준 중복 제거
    for (const a of (digest.article_bodies || [])) {
      if (a.url && seenUrls.has(a.url)) continue;
      if (a.url) seenUrls.add(a.url);
      allArticles.push({ ...a, date: dateLabel });
    }
    // 7일 내 레포트
    for (const r of (digest.report_texts || [])) {
      const rKey = `${r.msgId || r.fileName}`;
      if (seenReportIds.has(rKey)) continue;
      seenReportIds.add(rKey);
      allReports.push({ ...r, date: dateLabel });
    }
  }

  // 30일치 레포트 추가 (7일 이전 것만)
  for (const d of reportDigests) {
    for (const r of (d.report_texts || [])) {
      const rKey = `${r.msgId || r.fileName}`;
      if (seenReportIds.has(rKey)) continue;
      seenReportIds.add(rKey);
      allReports.push({ ...r, date: d.date_key || '' });
    }
  }

  return { allMessages, allArticles, allReports, latestYahoo };
}

// ═══ 시장전망 생성 (텔레그램+기사+레포트 우선, AI 보완) ═══
async function generateMarketView(data) {
  const { digests, yahooData, investingData, feedback } = data;
  const { allMessages, allArticles, allReports, latestYahoo } = mergeDigests(digests, data.reportDigests || []);
  const yahoo = Object.keys(latestYahoo).length > 0 ? latestYahoo : yahooData;
  const feedbackStr = feedback?.prompt_injection || '';

  // 시간순 메시지 구성 (날짜 라벨 포함)
  const msgContent = allMessages.slice(-50).map(m => `[${m.date}][${m.handle}] ${m.text.slice(0, 400)}`).join('\n---\n').slice(0, 20000);
  const articleStr = allArticles.slice(-10).map(a => `[${a.date}][기사: ${a.title}]\n${a.body.slice(0, 800)}`).join('\n---\n').slice(0, 10000);
  const reportStr = allReports.slice(-5).map(r => `[${r.date}][레포트: ${r.fileName}]\n${r.text.slice(0, 600)}`).join('\n---\n').slice(0, 5000);

  const systemPrompt = `당신은 증권사 수석 스트래티지스트입니다. 최근 7일간 축적된 텔레그램 채널 메시지, 뉴스 기사, 증권사 리포트를 시간순으로 종합 분석하여 Top-Down 시장전망을 작성합니다.

핵심 규칙:
1. 데이터는 시간순(오래된→최신)으로 정렬되어 있습니다. 최신 정보에 가장 높은 가중치를 두되, 이전 정보의 흐름과 변화도 반영하세요.
2. 수집된 텔레그램 메시지와 기사/레포트 내용을 최우선으로 활용하세요. 직접 인용하거나 구체적 수치를 반영하세요.
3. 수집 정보로 커버되지 않는 부분만 당신의 지식으로 보완하세요. 보완한 부분은 [AI 보완]을 표시하세요.
4. 각 섹션에 source_tag를 표시하세요: "tg"(텔레그램), "report"(레포트), "article"(기사), "ai"(AI 보완)
5. 전망은 구체적이고 상세하게 — 각 국가별 최소 8~12문장, PEG 수치, 핵심변수 3개 이상 포함
6. 시간 흐름에 따른 변화(예: "지난주 대비 금리 기대 하락", "3일 전 대비 외국인 매수세 전환")를 반드시 언급하세요.
7. 반드시 JSON으로만 응답하세요.

${feedbackStr ? `[피드백 루프]\n${feedbackStr}\n` : ''}`;

  const userPrompt = `## Yahoo Finance 수치
${JSON.stringify(yahoo, null, 1)}

## 경제지표 (Investing.com)
${JSON.stringify(Object.fromEntries(Object.entries(investingData).slice(0, 15).map(([k, v]) => [k, { latest: v?.records?.[0]?.actual, date: v?.records?.[0]?.date }])), null, 1)}

## 텔레그램 채널 메시지 원문 — 최근 7일 시간순 (${allMessages.length}개, 중복제거됨)
${msgContent}

## 기사 원문 (${allArticles.length}개)
${articleStr}

## 증권사 레포트 (${allReports.length}개)
${reportStr}

---

위 데이터는 최근 7일간 축적된 정보입니다. 시간순으로 정렬되어 있으며, 뒤쪽(최신)일수록 중요합니다.
이전 정보와 최신 정보의 변화 흐름을 반영하여 아래 JSON을 작성하세요:

{
  "indicators": { "kospi": { "value": "수치", "change": "+0.5%" }, "sp500": {...}, "nasdaq": {...}, "usdkrw": {...}, "gold": {...}, "wti": {...}, "nikkei": {...}, "shanghai": {...}, "taiex": {...}, "us10y": {...}, "kr_rate": "...", "us_rate": "..." },
  "macro": {
    "global": { "text": "글로벌 매크로 전망 8~12문장. 핵심변수 3개. 구체적 수치와 이벤트 반드시 포함.", "sources": ["tg","article"] },
    "us": { "text": "미국 전망 8~12문장. PEG, GDP, 금리, AI CapEx, 관세 등. 텔레그램 채널에서 언급된 내용 직접 반영.", "sources": ["tg","report"] },
    "kr": { "text": "한국 전망 8~12문장. 코스피, 반도체, 환율, 한은 금리, 밸류업. 채널별 시각 차이도 언급.", "sources": ["tg","report","article"] },
    "jp": { "text": "일본 전망 5~8문장.", "sources": ["tg"] },
    "cn": { "text": "중국 전망 5~8문장.", "sources": ["tg"] },
    "tw": { "text": "대만 전망 5~8문장.", "sources": ["ai"] }
  },
  "fx": { "text": "환율 전망 6~8문장. 원/달러 레인지. 상승/하락 요인 각 3개.", "sources": ["tg","article"] },
  "themes": [{ "name": "테마명", "tag": "bu/be/ne", "description": "3~4문장 상세 설명", "sources": ["tg"] }],
  "allocation": {
    "domestic": { "pct": 35, "amount": 3500, "detail": "상세 설명 3~4문장" },
    "overseas": { "pct": 25, "amount": 2500, "detail": "" },
    "gold": { "pct": 15, "amount": 1500, "detail": "" },
    "bonds": { "pct": 15, "amount": 1500, "detail": "" },
    "cash": { "pct": 10, "amount": 1000, "detail": "" }
  },
  "domestic_stocks": [{ "name": "삼성전자", "ticker": "005930", "weight_pct": 10, "amount": 1000, "reason": "편입 이유 2~3문장" }],
  "overseas_stocks": [{ "name": "엔비디아", "ticker": "NVDA", "weight_pct": 7, "amount": 700, "reason": "편입 이유 2~3문장" }],
  "gold_bonds_cash": [{ "name": "금ETF", "weight_pct": 10, "amount": 1000, "reason": "이유" }],
  "scenarios": [{ "name": "시나리오A", "tag": "bu/be/ne", "description": "3~4문장" }],
  "speaking_guide": "30초 스피킹 가이드 5~6문장",
  "predictions": [{ "category": "us_equity", "type": "numeric/direction/story/event", "prediction": "예측 내용", "target_range": "5800~5950", "confidence": 65, "timeframe": "1개월", "check_date": "2026-04-23" }]
}`;

  const result = await callClaude(systemPrompt, userPrompt, 8000);
  const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let mv;
  try { mv = JSON.parse(cleaned); } catch (e1) {
    try {
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) mv = JSON.parse(cleaned.slice(s, e + 1));
      else return null;
    } catch (e2) { return null; }
  }
  if (!mv) return null;

  // 구조 검증/교정
  if (typeof mv.macro !== 'object' || Array.isArray(mv.macro)) mv.macro = {};
  for (const [k, v] of Object.entries(mv.macro)) {
    if (typeof v === 'string') mv.macro[k] = { text: v, sources: ['ai'] };
    else if (typeof v?.text !== 'string') mv.macro[k] = { text: String(v?.text || v || ''), sources: v?.sources || ['ai'] };
  }
  if (typeof mv.fx === 'string') mv.fx = { text: mv.fx, sources: ['ai'] };
  else if (mv.fx && typeof mv.fx.text !== 'string') mv.fx = { text: String(mv.fx.text || ''), sources: mv.fx.sources || ['ai'] };
  if (!Array.isArray(mv.themes)) mv.themes = [];
  if (!Array.isArray(mv.scenarios)) mv.scenarios = [];
  if (!Array.isArray(mv.predictions)) mv.predictions = [];
  if (!Array.isArray(mv.domestic_stocks)) mv.domestic_stocks = [];
  if (!Array.isArray(mv.overseas_stocks)) mv.overseas_stocks = [];
  if (!Array.isArray(mv.gold_bonds_cash)) mv.gold_bonds_cash = [];
  if (typeof mv.speaking_guide !== 'string') mv.speaking_guide = String(mv.speaking_guide || '');
  if (typeof mv.allocation !== 'object' || Array.isArray(mv.allocation)) mv.allocation = {};

  return mv;
}
// ═══ API Handler — 포트폴리오 "자동입력" 버튼 ═══
export default async function handler(req, res) {
  try {
    const userId = req.query?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const dateKey = new Date().toISOString().slice(0, 10);

    const data = await gatherData();
    const marketView = await generateMarketView(data);
    if (!marketView) return res.status(500).json({ error: 'Market view generation failed' });

    // 종목분석은 별도 API (generate-stock-analysis.js)에서 처리
    // 시장전망만 저장하고, 종목분석은 클라이언트에서 순차 호출

    let version = 1;
    try {
      const { data: existing } = await supabase.from('outlooks').select('version').eq('user_id', userId).eq('date_key', dateKey)
        .order('version', { ascending: false }).limit(1).single();
      if (existing) version = existing.version + 1;
    } catch (e) {}

    await supabase.from('outlooks').insert({
      user_id: userId, date_key: dateKey,
      market_view: marketView, stock_analysis: {},
      sources: { digest_count: data.digests?.length || 0, latest_digest: data.digests?.[data.digests.length - 1]?.date_key || null },
      source_tags: marketView?.macro ? Object.fromEntries(Object.entries(marketView.macro).map(([k, v]) => [k, v.sources || ['ai']])) : {},
      version,
    });

    if (marketView.predictions?.length > 0) {
      await supabase.from('forecasts').insert(marketView.predictions.map(p => ({
        user_id: userId, category: p.category, type: p.type, prediction: p.prediction,
        target_range: p.target_range || '', confidence: p.confidence || 50,
        timeframe: p.timeframe || '', check_date: p.check_date, status: 'pending', source: 'ai',
      })));
    }

    return res.status(200).json({ success: true, date: dateKey, version, hasMarketView: !!marketView, step: 'market_view_done' });
  } catch (e) { return res.status(500).json({ error: e.message, stack: e.stack?.slice(0, 300) }); }
}
