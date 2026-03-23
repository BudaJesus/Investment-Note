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

export default async function handler(req, res) {
  try {
    // 최근 7일치 digest 전부 가져오기 (시간순)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: digests } = await supabase.from('telegram_digests')
      .select('*')
      .gte('collected_at', sevenDaysAgo.toISOString())
      .order('collected_at', { ascending: true }) // 오래된 것 → 최신
      .limit(20);
    if (!digests || digests.length === 0) return res.status(400).json({ error: '수집된 데이터가 없습니다. 헤더의 📡 정보 수집 버튼을 먼저 눌러주세요.' });

    const allMessages = [];
    const allArticles = [];
    const allReports = [];
    let yahooSnapshot = {};
    const seenMsgKeys = new Set();
    const seenUrls = new Set();
    
    for (const digest of digests) {
      const dateLabel = digest.date_key || '';
      if (digest.yahoo_snapshot && Object.keys(digest.yahoo_snapshot).length > 0) yahooSnapshot = { ...yahooSnapshot, ...digest.yahoo_snapshot };
      for (const [handle, msgs] of Object.entries(digest.raw_messages || {})) {
        for (const msg of msgs) {
          const key = `${handle}_${msg.id || msg.text.slice(0,30)}`;
          if (seenMsgKeys.has(key)) continue;
          seenMsgKeys.add(key);
          allMessages.push(`[${dateLabel}][${handle}] ${msg.text}`);
        }
      }
      for (const a of (digest.article_bodies || [])) {
        if (a.url && seenUrls.has(a.url)) continue;
        if (a.url) seenUrls.add(a.url);
        allArticles.push(a);
      }
      for (const r of (digest.report_texts || [])) allReports.push(r);
    }

    // 최신 80개 메시지 (뒤쪽이 최신)
    const msgContent = allMessages.slice(-80).join('\n---\n').slice(0, 60000);
    const articleContent = allArticles.slice(0, 15).map(a => `[기사: ${a.title}]\n${a.body.slice(0, 2000)}`).join('\n===\n').slice(0, 30000);
    const reportContent = allReports.slice(0, 5).map(r => `[${r.fileName}]\n${r.text.slice(0, 1500)}`).join('\n===\n').slice(0, 10000);

    const systemPrompt = `당신은 증권사 리서치센터 소속 시니어 스트래티지스트입니다.
최근 7일간 축적된 텔레그램 채널 메시지, 기사, 레포트를 시간순으로 읽고 투자일지를 작성합니다.
데이터는 [날짜][채널명] 형태로 시간순 정렬되어 있습니다. 최신 정보(뒤쪽)에 가장 높은 가중치를 두되, 이전 대비 변화 흐름도 반영하세요.

# 작업 프로세스 (반드시 이 순서대로)

## STEP 1: 팩트 추출
수집된 텔레그램 메시지를 한 줄 한 줄 읽으세요.
각 메시지에서 다음을 추출하세요:
- 구체적 숫자 (지수, 가격, 등락률, PER, 영업이익, 목표가, 확률)
- 이벤트 (FOMC, 금통위, 실적발표, 관세, 전쟁, 선거)
- 인과관계 ("A 때문에 B가 됐다")
- 전문가 발언 ("서상영: ~", "한지영: ~")
- 시간/일정 ("3/18 FOMC", "4월 금통위")

## STEP 2: 작성
추출한 팩트들을 카테고리별로 배치하세요.
**텔레그램 원문의 표현과 수치를 최대한 살리세요.**
당신이 새로 만들어낸 문장은 최소화하세요.

# 품질 기준

## 이렇게 쓰면 탈락 (❌)
- "미국 증시가 상승했다" → 너무 뻔함
- "경기 둔화 우려로 하락" → 무슨 지표? 몇 %?
- "향후 관망세 예상" → 뭘 관망? 언제까지?

## 이렇게 써야 합격 (✅)
- "파월 의장 상원 증언에서 '인플레 2% 목표 아직 미도달, 금리 인하 서두르지 않겠다' 발언. PCE 2.5%(예상 부합, 전월 2.6%)로 둔화 확인됐으나 근원PCE 2.8%로 Fed 목표 상회 지속. 엔비디아 매출 $351억(YoY+78%) 호실적에도 가이던스가 시장 눈높이($375억)에 못 미치며 -3.2% 하락. 필라델피아 반도체지수(SOX) -1.8%. 10년물 4.25%(-3bp)로 성장주 지지."
- "3/18~19 FOMC 금리 동결 확실시(CME FedWatch 92%). 점도표에서 연내 인하 횟수 2회→1회 축소 가능성 주시. 엔비디아 GTC(3/16~20) Blackwell Ultra 공개 여부가 반도체 섹터 방향 결정. 코스피 외국인 3일 연속 순매수(+4,200억) 지속 여부와 원/달러 1,470원 저항선 돌파 시 수출주 추가 반등 가능."

# 텔레그램 정보 부족 시
수집된 정보만으로 해당 항목을 채울 수 없는 경우:
1차: 함께 제공된 기사 원문에서 보완
2차: 레포트 내용에서 보완  
3차: 당신의 전문 지식으로 보완 (이 경우 문장 끝에 "[AI 보완]" 표시)
4차: 정말 아무 정보도 없으면 "해당부분은 수집된 정보에 포함되어 있지 않습니다"

JSON으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.`;

    const userPrompt = `## Yahoo Finance 수치
${JSON.stringify(yahooSnapshot, null, 1)}

## 텔레그램 채널 메시지 원문 (${allMessages.length}개)
${msgContent}

## 기사 원문 (${allArticles.length}개)  
${articleContent}

## 레포트 (${allReports.length}개)
${reportContent}

---

위 원본 데이터를 STEP 1→2 프로세스대로 분석하고, 아래 JSON을 작성하세요.
reason은 주요국가(미국·한국) 6~10문장, 기타국가 4~6문장. outlook은 주요국가 4~6문장, 기타 3~4문장. 섹터·종목도 reason 4~6문장, outlook 3~4문장. 숫자·이벤트·채널명이 없는 빈 문장은 절대 포함하지 마세요.
숫자와 구체적 이벤트가 없는 문장은 절대 포함하지 마세요.

{
  "marketNotes": {
    "us": { "reason": "4~6문장", "outlook": "3~5문장" },
    "kr": { "reason": "4~6문장", "outlook": "3~5문장" },
    "jp": { "reason": "3~4문장", "outlook": "2~3문장" },
    "cn": { "reason": "3~4문장", "outlook": "2~3문장" },
    "tw": { "reason": "2~3문장", "outlook": "2~3문장" },
    "eu": { "reason": "2~3문장", "outlook": "2~3문장" }
  },
  "bondOutlook": "3~5문장",
  "bondReasons": { "us10y": "3~4문장", "us2y": "2~3문장", "kr10y": "2~3문장", "kr3y": "2~3문장" },
  "fxOutlook": "3~5문장",
  "fxReasons": { "usdkrw": "3~4문장", "usdjpy": "2~3문장", "dxy": "2~3문장" },
  "commodityOutlook": "3~5문장",
  "commodityReasons": { "gold": "3~4문장", "silver": "1~2문장", "oil": "3~4문장", "natgas": "1~2문장", "btc": "2~3문장", "eth": "1~2문장" },
  "sectors": [
    { "name": "반도체", "change": "", "reason": "4~5문장", "outlook": "2~3문장" },
    { "name": "2차전지", "change": "", "reason": "3~4문장", "outlook": "2~3문장" },
    { "name": "자동차", "change": "", "reason": "3~4문장", "outlook": "2~3문장" },
    { "name": "바이오", "change": "", "reason": "2~3문장", "outlook": "2~3문장" },
    { "name": "방산/조선", "change": "", "reason": "3~4문장", "outlook": "2~3문장" },
    { "name": "전력기기", "change": "", "reason": "2~3문장", "outlook": "2~3문장" },
    { "name": "금융/은행", "change": "", "reason": "2~3문장", "outlook": "2~3문장" }
  ],
  "stocks": [
    { "name": "삼성전자", "ticker": "005930", "price": "", "change": "", "reason": "3~5문장", "outlook": "2~3문장" },
    { "name": "SK하이닉스", "ticker": "000660", "price": "", "change": "", "reason": "3~5문장", "outlook": "2~3문장" },
    { "name": "현대차", "ticker": "005380", "price": "", "change": "", "reason": "2~3문장", "outlook": "2~3문장" },
    { "name": "한화오션", "ticker": "042660", "price": "", "change": "", "reason": "2~3문장", "outlook": "2~3문장" },
    { "name": "HD현대일렉트릭", "ticker": "267260", "price": "", "change": "", "reason": "2~3문장", "outlook": "2~3문장" },
    { "name": "엔비디아", "ticker": "NVDA", "price": "", "change": "", "reason": "2~3문장", "outlook": "2~3문장" }
  ],
  "memo": "4~6문장. 오늘 시장 한줄 요약 + 핵심 이벤트 3개 + 내일/이번주 주시사항 + 투자 시사점."
}`;

    // ── 1차 Claude 호출 ──
    let parsed = await callAndParse(systemPrompt, userPrompt, 8000);
    if (!parsed) return res.status(500).json({ error: 'Claude 응답 파싱 실패' });

    // ── 데이터 구조 검증/교정 ──
    parsed = validateAndFix(parsed);

    // ── 내용 품질 검증 — 부실하면 재요청 ──
    const quality = checkQuality(parsed);
    if (quality.score < 60) {
      console.log(`Quality low (${quality.score}/100): ${quality.issues.join(', ')}. Retrying...`);
      const retryPrompt = `이전 응답의 문제점: ${quality.issues.join('. ')}

다시 작성하세요. 특히 부족한 부분을 보완하세요.
reason은 주요국 6~10문장, outlook은 4~6문장이 필수입니다.
숫자 없는 문장은 절대 안 됩니다.

${userPrompt}`;
      const retried = await callAndParse(systemPrompt, retryPrompt, 8000);
      if (retried) {
        const fixedRetry = validateAndFix(retried);
        // 재요청 결과가 더 나으면 교체, 아니면 원본 유지
        const retryQuality = checkQuality(fixedRetry);
        if (retryQuality.score > quality.score) {
          parsed = fixedRetry;
          console.log(`Retry improved: ${quality.score} → ${retryQuality.score}`);
        }
      }
    }

    return res.status(200).json({ success: true, data: parsed, yahoo: yahooSnapshot, quality: checkQuality(parsed) });
  } catch (e) {
    console.error('auto-fill-journal error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// ── Claude 호출 + JSON 파싱 ──
async function callAndParse(systemPrompt, userPrompt, maxTokens) {
  try {
    const result = await callClaude(systemPrompt, userPrompt, maxTokens);
    let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e1) {
      try {
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
      } catch (e2) {}
    }
    return null;
  } catch (e) { return null; }
}

// ── 데이터 구조 검증/교정 ──
function validateAndFix(parsed) {
  if (!parsed) return parsed;
      // marketNotes: 반드시 object
      if (typeof parsed.marketNotes !== 'object' || Array.isArray(parsed.marketNotes)) parsed.marketNotes = {};
      // 각 국가별 reason/outlook: 반드시 string
      for (const [k, v] of Object.entries(parsed.marketNotes || {})) {
        if (typeof v === 'string') parsed.marketNotes[k] = { reason: v, outlook: '' };
        else if (typeof v !== 'object') parsed.marketNotes[k] = { reason: '', outlook: '' };
        else {
          if (typeof v.reason !== 'string') v.reason = v.reason?.text || String(v.reason || '');
          if (typeof v.outlook !== 'string') v.outlook = v.outlook?.text || String(v.outlook || '');
        }
      }
      // bondReasons, fxReasons, commodityReasons: 반드시 object with string values
      for (const field of ['bondReasons', 'fxReasons', 'commodityReasons']) {
        if (typeof parsed[field] !== 'object' || Array.isArray(parsed[field])) parsed[field] = {};
        for (const [k, v] of Object.entries(parsed[field] || {})) {
          if (typeof v !== 'string') parsed[field][k] = v?.text || String(v || '');
        }
      }
      // outlook 필드들: 반드시 string
      for (const field of ['bondOutlook', 'fxOutlook', 'commodityOutlook', 'memo']) {
        if (typeof parsed[field] !== 'string') parsed[field] = parsed[field]?.text || String(parsed[field] || '');
      }
      // sectors, stocks: 반드시 array
      if (!Array.isArray(parsed.sectors)) parsed.sectors = [];
      if (!Array.isArray(parsed.stocks)) parsed.stocks = [];
      // sectors 내부 값 검증
      parsed.sectors = parsed.sectors.map(s => ({
        name: String(s?.name || ''), change: String(s?.change || ''),
        reason: String(s?.reason || s?.reason?.text || ''), outlook: String(s?.outlook || s?.outlook?.text || ''),
      }));
      // stocks 내부 값 검증
      parsed.stocks = parsed.stocks.map(s => ({
        name: String(s?.name || ''), ticker: String(s?.ticker || ''),
        price: String(s?.price || ''), change: String(s?.change || ''),
        reason: String(s?.reason || s?.reason?.text || ''), outlook: String(s?.outlook || s?.outlook?.text || ''),
      }));
  return parsed;
}

// ── 내용 품질 검증 ──
function checkQuality(parsed) {
  if (!parsed) return { score: 0, issues: ['파싱 실패'] };
  const issues = [];
  let score = 100;

  // 주요국(us, kr) reason/outlook 길이 체크
  const mn = parsed.marketNotes || {};
  for (const country of ['us', 'kr']) {
    const r = mn[country]?.reason || '';
    const o = mn[country]?.outlook || '';
    if (r.length < 100) { score -= 15; issues.push(`${country} reason 너무 짧음 (${r.length}자, 최소 100자)`); }
    if (o.length < 50) { score -= 10; issues.push(`${country} outlook 너무 짧음 (${o.length}자, 최소 50자)`); }
  }

  // 기타국가 존재 체크
  for (const country of ['jp', 'cn', 'tw', 'eu']) {
    if (!mn[country]?.reason) { score -= 5; issues.push(`${country} reason 없음`); }
  }

  // 채권/환율/원자재 전망
  if (!parsed.bondOutlook || parsed.bondOutlook.length < 30) { score -= 5; issues.push('bondOutlook 부족'); }
  if (!parsed.fxOutlook || parsed.fxOutlook.length < 30) { score -= 5; issues.push('fxOutlook 부족'); }
  if (!parsed.commodityOutlook || parsed.commodityOutlook.length < 30) { score -= 5; issues.push('commodityOutlook 부족'); }

  // 개별 reason 체크
  const br = parsed.bondReasons || {};
  if (!br.us10y || br.us10y.length < 20) { score -= 3; issues.push('us10y reason 부족'); }
  const fr = parsed.fxReasons || {};
  if (!fr.usdkrw || fr.usdkrw.length < 20) { score -= 3; issues.push('usdkrw reason 부족'); }

  // 섹터/종목
  if ((parsed.sectors || []).length < 3) { score -= 10; issues.push(`섹터 ${parsed.sectors?.length || 0}개 (최소 3개)`); }
  if ((parsed.stocks || []).length < 3) { score -= 10; issues.push(`종목 ${parsed.stocks?.length || 0}개 (최소 3개)`); }

  // memo
  if (!parsed.memo || parsed.memo.length < 30) { score -= 5; issues.push('memo 부족'); }

  return { score: Math.max(0, score), issues };
}