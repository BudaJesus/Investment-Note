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
    // 레포트 전용 쿼리: report_texts + raw_messages만 (전체 * 아님!)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: digests, error } = await supabase
      .from('telegram_digests')
      .select('report_texts, raw_messages, date_key')
      .gte('collected_at', thirtyDaysAgo.toISOString())
      .order("collected_at", { ascending: true })
      .limit(10);

    if (error || !digests || digests.length === 0)
      return res.status(200).json({ success: true, reports: [], debug: 'No digests found' });

    // 1. 레포트 텍스트
    const allReports = [];
    for (const d of digests) {
      for (const r of (d.report_texts || [])) allReports.push(r);
    }

    // 2. 메시지에서 레포트 관련 내용만 빠르게 필터 (전체 보내지 않음)
    const REPORT_KEYWORDS = ['리포트', '리서치', '레포트', '보고서', '목표가', '투자의견', 'BUY', 'SELL', 'Buy', 'Sell', '매수', '매도', '비중확대', '비중축소', '중립', '상향', '하향', 'TP ', 'TP:', '영업이익', '컨센서스', '분기실적', '어닝', '실적발표', '커버리지', '.pdf', 'PDF'];
    const reportMessages = [];
    for (const d of digests) {
      for (const [handle, msgs] of Object.entries(d.raw_messages || {})) {
        for (const msg of msgs) {
          if (msg.text && msg.text.length > 30 && REPORT_KEYWORDS.some(kw => msg.text.includes(kw))) {
            reportMessages.push(`[${d.date_key || ''}][${handle}] ${msg.text.slice(0, 600)}`);
          }
        }
      }
    }

    if (allReports.length === 0 && reportMessages.length === 0) {
      return res.status(200).json({ success: true, reports: [], debug: `No data. reports=${allReports.length}, messages=${reportMessages.length}, digests=${digests.length}` });
    }

    const content = [
      allReports.length > 0 ? `=== PDF 레포트 (${allReports.length}개) ===` : '',
      ...allReports.map(r => `[파일: ${r.fileName}]\n${r.text.slice(0, 1500)}`),
      `\n=== 레포트 관련 메시지 (${reportMessages.length}개) ===`,
      ...reportMessages.slice(0, 30),
    ].filter(Boolean).join('\n---\n').slice(0, 30000);

    const systemPrompt = `당신은 증권사 리서치 편집자입니다. 레포트 텍스트와 텔레그램 메시지에서 증권사 리포트를 추출하여 정리합니다.

핵심 규칙:
1. PDF 레포트는 이미 섹션별로 정리되어 있습니다. 이 구조를 그대로 활용하세요.
2. 요약하지 마세요. 원본의 수치, 데이터, 투자의견, 목표가, 분석 내용을 최대한 그대로 가져오세요.
3. summary 필드에는 핵심 논점 + 데이터 + 결론을 빠짐없이 넣으세요. 길어도 됩니다.
4. 텔레그램 메시지에서 "목표가 상향", "투자의견 매수" 등이 있으면 그것도 별도 레포트 항목으로 만드세요.
5. 최소 5개 이상 추출하세요.

섹터 id: semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other
증권사 id: samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other
JSON 배열로만 응답하세요.
중요: summary 텍스트 안에 큰따옴표(")를 쓰지 마세요. 작은따옴표(')나 「」를 대신 사용하세요. JSON이 깨집니다.`;

    const userPrompt = `${content}\n\nJSON 배열:\n[\n  { "title": "리포트 제목", "source": "증권사id(samsung/mirae/kb/nh/hana/shinhan/kiwoom/daishin/hanwha/meritz/im/other)", "sector": "섹터id(semi/battery/bio/auto/it/finance/energy/consumer/industrial/realestate/macro/other)", "analyst": "애널리스트명", "summary": "핵심논점+데이터+투자의견+목표가+결론을 빠짐없이. 요약하지말고 정리. 10문장 이상 가능.", "stocks": "관련종목(쉼표구분)", "target_price": "목표가", "opinion": "매수/중립/매도", "rating": 3, "date": "${new Date().toISOString().slice(0,10)}" }\n]`;

    const result = await callClaude(systemPrompt, userPrompt, 6000);
    let cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // JSON 파싱 안전 처리 — 레포트 텍스트에 따옴표/특수문자가 많아서 깨지기 쉬움
    let reports;
    try {
      reports = JSON.parse(cleaned);
    } catch (parseErr) {
      // 복구 시도 1: 제어 문자 제거
      try {
        cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\\/g, '\\\\').replace(/(?<!\\)"/g, (m, offset) => {
          // JSON 구조적 따옴표는 유지, 텍스트 내 따옴표만 이스케이프
          return m;
        });
        reports = JSON.parse(cleaned);
      } catch (e2) {
        // 복구 시도 2: 배열 시작~끝만 추출
        try {
          const arrStart = cleaned.indexOf('[');
          const arrEnd = cleaned.lastIndexOf(']');
          if (arrStart >= 0 && arrEnd > arrStart) {
            reports = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
          } else {
            throw new Error('No JSON array found');
          }
        } catch (e3) {
          return res.status(500).json({ error: 'JSON 파싱 실패. Claude 응답이 유효한 JSON이 아닙니다.', raw: cleaned.slice(0, 500) });
        }
      }
    }

    // 데이터 검증
    if (!Array.isArray(reports)) reports = [];
    reports = reports.filter(r => r && typeof r === 'object').map(r => ({
      title: String(r.title || ''), source: String(r.source || 'other'), sector: String(r.sector || 'other'),
      analyst: String(r.analyst || ''), summary: String(r.summary || ''),
      stocks: String(r.stocks || ''), target_price: String(r.target_price || ''),
      opinion: String(r.opinion || ''), rating: Number(r.rating) || 3,
      date: String(r.date || new Date().toISOString().slice(0, 10)),
    }));

    return res.status(200).json({ success: true, reports, count: reports.length });
  } catch (e) {
    console.error('auto-fill-report error:', e);
    return res.status(500).json({ error: e.message });
  }
}
