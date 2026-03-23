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
  const result = { yahooData: {}, investingData: {}, digest: null, feedback: null };
  try {
    const { data } = await supabase.from('auto_data').select('yahoo_data, investing_data').order('date_key', { ascending: false }).limit(1).single();
    if (data) { result.yahooData = data.yahoo_data || {}; result.investingData = data.investing_data || {}; }
  } catch (e) {}
  try {
    const { data } = await supabase.from('telegram_digests').select('*').order('collected_at', { ascending: false }).limit(1).single();
    if (data) result.digest = data;
  } catch (e) {}
  try {
    const { data } = await supabase.from('feedback_prompts').select('prompt_injection, hit_rates').order('generated_at', { ascending: false }).limit(1).single();
    if (data) result.feedback = data;
  } catch (e) {}
  return result;
}

// ═══ 시장전망 생성 (텔레그램+기사+레포트 우선, AI 보완) ═══
async function generateMarketView(data) {
  const { digest, yahooData, investingData, feedback } = data;
  const raw = digest?.raw_messages || {};
  const articles = digest?.article_bodies || [];
  const reports = digest?.report_texts || [];
  const yahoo = digest?.yahoo_snapshot || yahooData || {};

  // 전체 메시지 합치기 (원문)
  const allMsgs = [];
  for (const [handle, msgs] of Object.entries(raw)) {
    for (const msg of msgs) allMsgs.push(`[${handle}] ${msg.text.slice(0, 600)}`);
  }

  const articleStr = articles.slice(0, 15).map(a => `[기사: ${a.title}]\n${a.body.slice(0, 1200)}`).join('\n---\n');
  const reportStr = reports.slice(0, 5).map(r => `[레포트: ${r.fileName}]\n${r.text.slice(0, 800)}`).join('\n---\n');
  const feedbackStr = feedback?.prompt_injection || '';

  const systemPrompt = `당신은 증권사 수석 스트래티지스트입니다. 수집된 텔레그램 채널 메시지, 뉴스 기사 원문, 증권사 리포트를 종합 분석하여 Top-Down 시장전망을 작성합니다.

핵심 규칙:
1. 수집된 텔레그램 메시지와 기사/레포트 내용을 최우선으로 활용하세요. 직접 인용하거나 구체적 수치를 반영하세요.
2. 수집 정보로 커버되지 않는 부분만 당신의 지식으로 보완하세요.
3. 각 섹션에 source_tag를 표시하세요: "tg"(텔레그램), "report"(레포트), "article"(기사), "ai"(AI 보완)
4. 전망은 구체적이고 상세하게 — 각 국가별 최소 8~10문장, PEG 수치, 핵심변수 3개 이상 포함
5. 반드시 JSON으로만 응답하세요.

${feedbackStr ? `[피드백 루프]\n${feedbackStr}\n` : ''}`;

  const userPrompt = `## Yahoo Finance 수치
${JSON.stringify(yahoo, null, 1)}

## 경제지표 (Investing.com)
${JSON.stringify(Object.fromEntries(Object.entries(investingData).slice(0, 15).map(([k, v]) => [k, { latest: v?.records?.[0]?.actual, date: v?.records?.[0]?.date }])), null, 1)}

## 텔레그램 채널 메시지 원문 (${allMsgs.length}개)
${allMsgs.slice(0, 60).join('\n---\n').slice(0, 30000)}

## 기사 원문 (${articles.length}개)
${articleStr.slice(0, 20000)}

## 증권사 레포트 (${reports.length}개)
${reportStr.slice(0, 10000)}

---

위 정보를 종합하여 아래 JSON을 작성하세요:

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
  try { return JSON.parse(result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); }
  catch (e) { return null; }
}

// ═══ 종목분석 생성 (금융권면접 HTML 양식) ═══
async function generateStockAnalysis(data, marketView) {
  const { digest, feedback } = data;
  const raw = digest?.raw_messages || {};
  const articles = digest?.article_bodies || [];
  const reports = digest?.report_texts || [];
  const feedbackStr = feedback?.prompt_injection || '';

  const allMsgs = [];
  for (const [handle, msgs] of Object.entries(raw)) {
    for (const msg of msgs) allMsgs.push(`[${handle}] ${msg.text.slice(0, 400)}`);
  }

  const stocks = [...(marketView?.domestic_stocks || []), ...(marketView?.overseas_stocks || [])];

  const systemPrompt = `당신은 증권사 리서치센터 애널리스트입니다. 포트폴리오 편입 종목의 상세 분석을 작성합니다.

반드시 포함할 항목 (종목당):
- 기업개요 (3~4문장: 사업 영역, 시장 점유율, 시총, 직원수)
- 대표 제품/서비스 (구체적 제품명 나열)
- 재무 데이터 (주가, 시총, PER TTM/Forward, PEG, 영업이익 실적/전망, 목표가, OPM)
- 투자포인트 3개 (각 3~4문장, 구체적 수치 포함)
- 리스크 (3개, 구체적)
- source_tags: 텔레그램/리포트/기사/AI 중 해당 소스 표시

수집된 텔레그램 메시지와 기사/레포트를 최우선 활용하세요.
JSON으로만 응답하세요.

${feedbackStr ? `[피드백 루프]\n${feedbackStr}` : ''}`;

  const userPrompt = `## 편입 종목
${JSON.stringify(stocks, null, 1)}

## 텔레그램 메시지 (${allMsgs.length}개)
${allMsgs.slice(0, 40).join('\n---\n').slice(0, 20000)}

## 기사 원문 (${articles.length}개)
${articles.slice(0, 10).map(a => `[${a.title}] ${a.body.slice(0, 800)}`).join('\n---\n').slice(0, 15000)}

## 레포트 (${reports.length}개)
${reports.slice(0, 5).map(r => `[${r.fileName}] ${r.text.slice(0, 600)}`).join('\n---\n').slice(0, 8000)}

---

아래 JSON을 작성하세요:

{
  "peg_table": [
    { "name": "코스피 전체", "fwd_per": 13, "eps_growth": 47, "peg": 0.28, "verdict": "극저평가" },
    { "name": "S&P500", "fwd_per": 21, "eps_growth": 13, "peg": 1.6, "verdict": "적정~고평가" }
  ],
  "sectors": [
    {
      "name": "반도체",
      "peg": 0.10,
      "peg_verdict": "극저평가",
      "stocks": [
        {
          "name": "삼성전자", "ticker": "005930", "market": "KRX",
          "weight_pct": 10,
          "overview": "기업개요 3~4문장 (사업영역, 시장점유율, 시총, 직원수 포함)",
          "products": "HBM3E · 2나노 GAA 파운드리 · 갤럭시 S26 · HBM4",
          "price": "188,000원", "market_cap": "1,120조",
          "per_ttm": "24.9", "per_fwd": "~10", "peg": 0.25,
          "op_profit": "52.4조 (2025)", "op_profit_estimate": "148~200조 (2026E)",
          "opm": "15.2%",
          "target_price": "236,000~260,000",
          "analyst_consensus": "35명 전원 매수",
          "invest_points": [
            "① HBM 슈퍼사이클 최대 수혜. (3~4문장 상세 설명, 구체적 수치)",
            "② 사상 최대 실적. (3~4문장)",
            "③ 밸류업+코리아 디스카운트 해소. (3~4문장)"
          ],
          "risks": "HBM3E 납품 지연 · 미국 관세/수출 규제 · 파운드리 2나노 수율",
          "naver_link": "https://finance.naver.com/item/main.naver?code=005930",
          "source_tags": ["tg", "report"]
        }
      ]
    }
  ],
  "overseas": [
    {
      "name": "해외 AI빅테크+에너지+배당",
      "peg": 1.6, "peg_verdict": "적정",
      "stocks": [
        {
          "name": "엔비디아", "ticker": "NVDA", "market": "NASDAQ",
          "weight_pct": 7,
          "overview": "기업개요 3~4문장",
          "products": "H100/H200 · Blackwell Ultra · DGX SuperPOD · DRIVE",
          "price": "~$120",
          "revenue_quarterly": "$260억+", "fcf_quarterly": "$200억+",
          "per_fwd": 40, "peg": 0.80,
          "invest_points": ["① 포인트 3~4문장", "② 포인트", "③ 포인트"],
          "risks": "밸류에이션 부담 · AMD/인텔 경쟁 · AI 사이클 피크 우려",
          "source_tags": ["tg", "ai"]
        }
      ]
    }
  ]
}

반도체, 조선방산, 전력기기, 자동차, 바이오 등 국내 편입 종목 전체 + 해외 종목 전체를 빠짐없이 작성하세요.`;

  const result = await callClaude(systemPrompt, userPrompt, 8000);
  try { return JSON.parse(result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); }
  catch (e) { return null; }
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

    const stockAnalysis = await generateStockAnalysis(data, marketView);

    let version = 1;
    try {
      const { data: existing } = await supabase.from('outlooks').select('version').eq('user_id', userId).eq('date_key', dateKey)
        .order('version', { ascending: false }).limit(1).single();
      if (existing) version = existing.version + 1;
    } catch (e) {}

    await supabase.from('outlooks').insert({
      user_id: userId, date_key: dateKey,
      market_view: marketView, stock_analysis: stockAnalysis || {},
      sources: { digest_id: data.digest?.id || null },
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

    return res.status(200).json({ success: true, date: dateKey, version, hasMarketView: !!marketView, hasStockAnalysis: !!stockAnalysis });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
