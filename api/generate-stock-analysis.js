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
    const userId = req.query?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });

    // 1. 최신 outlook에서 시장전망의 종목 리스트 가져오기
    const { data: outlook } = await supabase.from('outlooks').select('*')
      .eq('user_id', userId).order('generated_at', { ascending: false }).limit(1).single();

    if (!outlook?.market_view) return res.status(400).json({ error: '시장전망이 없습니다. 포트폴리오 자동입력을 먼저 실행하세요.' });

    const mv = outlook.market_view;
    const stocks = [...(mv.domestic_stocks || []), ...(mv.overseas_stocks || [])];
    if (stocks.length === 0) return res.status(400).json({ error: '포트폴리오에 편입된 종목이 없습니다.' });

    // 2. 텔레그램 데이터
    const { data: digest } = await supabase.from('telegram_digests').select('raw_messages, article_bodies, report_texts')
      .order('collected_at', { ascending: false }).limit(1).single();

    const allMsgs = [];
    if (digest?.raw_messages) {
      for (const [handle, msgs] of Object.entries(digest.raw_messages)) {
        for (const msg of msgs) allMsgs.push(`[${handle}] ${msg.text.slice(0, 500)}`);
      }
    }
    const articles = (digest?.article_bodies || []).slice(0, 10).map(a => `[${a.title}] ${a.body.slice(0, 800)}`);
    const reports = (digest?.report_texts || []).slice(0, 5).map(r => `[${r.fileName}] ${r.text.slice(0, 600)}`);

    // 3. 피드백
    let feedbackStr = '';
    try {
      const { data: fb } = await supabase.from('feedback_prompts').select('prompt_injection')
        .order('generated_at', { ascending: false }).limit(1).single();
      if (fb?.prompt_injection) feedbackStr = fb.prompt_injection;
    } catch (e) {}

    const systemPrompt = `당신은 증권사 리서치센터 시니어 애널리스트입니다.
포트폴리오 편입 종목의 상세 분석을 작성합니다.

# 절대 규칙
1. 텔레그램 채널과 기사/레포트에 있는 정보를 최우선으로 사용하세요.
2. 각 종목당 반드시 포함: 기업개요(3~4문장) · 대표제품 · 주가/시총/PER/PEG/영업이익/목표가 · 투자포인트 3개(각 3~4문장) · 리스크 3개
3. 투자포인트는 구체적 수치와 인과관계를 포함하세요. "성장하고 있다" 같은 뻔한 말 금지.
4. 텔레그램 정보가 부족한 종목은 당신의 지식으로 보완하되, 문장 끝에 [AI 보완]을 붙이세요.
5. source_tags: "tg"(텔레그램 소스 있음), "report"(레포트 소스 있음), "article"(기사), "ai"(AI 보완)

${feedbackStr ? `[피드백 루프]\n${feedbackStr}` : ''}

JSON으로만 응답하세요.`;

    const userPrompt = `## 분석 대상 종목 (시장전망 포트폴리오에서 추출)
${JSON.stringify(stocks, null, 1)}

## 텔레그램 메시지 (${allMsgs.length}개)
${allMsgs.slice(0, 40).join('\n---\n').slice(0, 25000)}

## 기사 (${articles.length}개)
${articles.join('\n---\n').slice(0, 12000)}

## 레포트 (${reports.length}개)
${reports.join('\n---\n').slice(0, 8000)}

---

위 종목들을 섹터별로 묶어서 상세 분석하세요.

{
  "peg_table": [
    { "name": "코스피 전체", "fwd_per": 13, "eps_growth": 47, "peg": 0.28, "verdict": "극저평가" },
    { "name": "S&P500", "fwd_per": 21, "eps_growth": 13, "peg": 1.6, "verdict": "적정" },
    { "name": "니케이225", "fwd_per": 22, "eps_growth": 15, "peg": 1.5, "verdict": "적정" },
    { "name": "반도체", "fwd_per": 10.5, "eps_growth": 100, "peg": 0.10, "verdict": "극저평가" },
    { "name": "조선방산", "fwd_per": 18, "eps_growth": 30, "peg": 0.60, "verdict": "저평가" },
    { "name": "전력기기", "fwd_per": 28, "eps_growth": 40, "peg": 0.70, "verdict": "저평가" },
    { "name": "자동차", "fwd_per": 6.5, "eps_growth": 10, "peg": 0.65, "verdict": "저평가" },
    { "name": "바이오", "fwd_per": 48, "eps_growth": 25, "peg": 1.92, "verdict": "고평가" }
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
          "overview": "세계 최대 메모리 반도체(DRAM 42%, NAND 33%) + 파운드리 + 스마트폰(갤럭시). 시총 코스피 1위. 직원 12.8만 명. [출처에 따라 상세 기술]",
          "products": "HBM3E · 2나노 GAA 파운드리 · 갤럭시 S26 · HBM4(2026하반기)",
          "price": "188,000원",
          "market_cap": "1,120조",
          "per_ttm": "24.9",
          "per_fwd": "~10",
          "peg": 0.25,
          "op_profit": "52.4조 (2025)",
          "op_profit_estimate": "148~200조 (2026E)",
          "opm": "15.2%",
          "target_price": "236,000~260,000",
          "analyst_consensus": "35명 전원 매수",
          "invest_points": [
            "① HBM 슈퍼사이클 최대 수혜. 엔비디아 H200·Blackwell GPU에 HBM3E 대량 공급 중. HBM4는 파운드리 4nm을 결합해 경쟁사 대비 전력효율 차별화. SK하이닉스 대비 후발이었으나 HBM4에서 격차 축소 예정. [3~4문장]",
            "② 사상 최대 실적 경신. 2025 4Q 영업이익 20.1조(YoY+208%). 키움증권 2026년 200조, 유진투자 148조 전망. 현재가 18.8만 대비 목표가 평균 25.3만(괴리율 34%). 애널리스트 35명 전원 매수.",
            "③ 밸류업+코리아 디스카운트 해소. 글로벌 반도체 대장주 중 PBR 최저 수준. 상법 개정+배당소득 분리과세+자사주 매입 확대로 리레이팅 여지."
          ],
          "risks": "HBM3E 납품 시점 지연 이력(SK하이닉스 대비 후발) · 미국 관세/반도체 수출 규제 강화 · 파운드리 2나노 수율 안정화 지연",
          "naver_link": "https://finance.naver.com/item/main.naver?code=005930",
          "source_tags": ["tg", "report"]
        }
      ]
    }
  ],
  "overseas": [
    {
      "name": "해외 AI빅테크+에너지+배당",
      "peg": 1.6,
      "peg_verdict": "적정",
      "stocks": [
        {
          "name": "엔비디아", "ticker": "NVDA", "market": "NASDAQ",
          "weight_pct": 7,
          "overview": "AI GPU 설계 독점(데이터센터 GPU 점유율 90%+). CUDA 소프트웨어 생태계가 절대적 해자. 시총 $3.5조.",
          "products": "H100/H200 · Blackwell Ultra · DGX SuperPOD · DRIVE(자율주행)",
          "price": "~$120",
          "revenue_quarterly": "$260억+",
          "fcf_quarterly": "$200억+",
          "per_fwd": 40,
          "peg": 0.80,
          "invest_points": [
            "① AI GPU 점유율 90%+ CUDA 해자. AMD MI300X 추격하나 SW 전환비용 막대→2~3년 리드 유지. [3~4문장]",
            "② 닷컴버블과 다름 = 자생적 현금흐름. 분기 FCF $200억+. 매출 CAGR 40%+.",
            "③ Blackwell Ultra + 자율주행 로봇 플랫폼. AI 응용 확대→TAM 확장."
          ],
          "risks": "밸류에이션 부담(PER 40) · AMD/인텔 경쟁 · AI 투자 사이클 피크 우려",
          "source_tags": ["tg", "ai"]
        }
      ]
    }
  ]
}

모든 편입 종목(국내+해외)을 빠짐없이 분석하세요. 섹터: 반도체/조선방산/전력기기/자동차/바이오 + 해외.`;

    const result = await callClaude(systemPrompt, userPrompt, 8000);
    let stockAnalysis;
    try {
      stockAnalysis = JSON.parse(result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
    } catch (e) {
      return res.status(500).json({ error: 'JSON 파싱 실패: ' + e.message });
    }

    // 4. 기존 outlook 업데이트
    const { error: updateError } = await supabase.from('outlooks')
      .update({ stock_analysis: stockAnalysis })
      .eq('id', outlook.id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    return res.status(200).json({ success: true, sectors: stockAnalysis.sectors?.length || 0, overseas: stockAnalysis.overseas?.length || 0 });
  } catch (e) {
    console.error('generate-stock-analysis error:', e);
    return res.status(500).json({ error: e.message });
  }
}
