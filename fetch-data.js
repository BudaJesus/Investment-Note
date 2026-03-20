import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══════════════════════════════════════════════════
// Yahoo Finance — 증시 + 채권 + 원자재 + 환율
// ═══════════════════════════════════════════════════
const YAHOO_SYMBOLS = {
  "sp500": "^GSPC", "nasdaq": "^IXIC", "dow": "^DJI", "russell": "^RUT", "sox": "^SOX",
  "nikkei": "^N225", "topix": "^TOPX",
  "kospi": "^KS11", "kosdaq": "^KQ11",
  "shanghai": "000001.SS", "shenzhen": "399001.SZ", "hang": "^HSI",
  "taiex": "^TWII",
  "us10y": "^TNX",
  "gold": "GC=F", "silver": "SI=F", "oil": "CL=F", "natgas": "NG=F",
  "btc": "BTC-USD", "eth": "ETH-USD",
  "usdkrw": "KRW=X", "usdjpy": "JPY=X", "dxy": "DX-Y.NYB",
};

// ═══════════════════════════════════════════════════
// ECOS — 한국 국채 수익률 (Yahoo에 없으므로 유지)
// ═══════════════════════════════════════════════════
const ECOS_BONDS = {
  "kr3y":  { table: "817Y002", item: "010200000" },
  "kr10y": { table: "817Y002", item: "010210000" },
};

// ═══════════════════════════════════════════════════
// Investing.com — 경제 지표 (FRED/ECOS 완전 대체)
// URL에서 추출한 event_id 매핑
// ═══════════════════════════════════════════════════
const INVESTING_EVENTS = {
  // ── 금리 ──
  "us_rate":     { eventId: 168,  name: "미국 기준금리" },
  "kr_rate":     { eventId: 473,  name: "한국 기준금리" },
  "jp_rate":     { eventId: 165,  name: "일본 기준금리" },
  "eu_rate":     { eventId: 164,  name: "유로 기준금리" },
  "cn_lpr1y":    { eventId: 1967, name: "중국 LPR 1년" },
  "cn_lpr5y":    { eventId: 2225, name: "중국 LPR 5년" },
  "cn_rrr":      { eventId: 1084, name: "중국 예금지준율" },
  // ── 물가/경기 ──
  "us_cpi":      { eventId: 733,  name: "미국 CPI" },
  "us_core_cpi": { eventId: 736,  name: "미국 근원CPI" },
  "us_pce":      { eventId: 906,  name: "미국 PCE" },
  "us_core_pce": { eventId: 905,  name: "미국 근원PCE" },
  "us_ppi":      { eventId: 734,  name: "미국 PPI" },
  "kr_cpi":      { eventId: 467,  name: "한국 CPI" },
  "kr_core_cpi": { eventId: 467,  name: "한국 근원물가" },
  "jp_cpi":      { eventId: 992,  name: "일본 CPI" },
  "eu_cpi":      { eventId: 68,   name: "유로 CPI" },
  "us_retail":   { eventId: 256,  name: "미국 소매판매" },
  "us_ism":      { eventId: 173,  name: "미국 ISM PMI" },
  "kr_ppi":      { eventId: 747,  name: "한국 PPI" },
  // ── 고용 ──
  "us_nfp":      { eventId: 227,  name: "미국 비농업고용" },
  "us_adp":      { eventId: 1,    name: "미국 ADP 고용" },
  "us_unemp":    { eventId: 300,  name: "미국 실업률" },
  "us_claims":   { eventId: 294,  name: "실업수당 청구" },
  "kr_unemp":    { eventId: 469,  name: "한국 실업률" },
  "us_jolts":    { eventId: 1057, name: "JOLTS 구인건수" },
  // ── 기타 ──
  "oil_inv":     { eventId: 75,   name: "원유재고" },
  "kr_gdp_qq":   { eventId: 471,  name: "한국 GDP QoQ" },
  "kr_gdp_yy":   { eventId: 745,  name: "한국 GDP YoY" },
  "cn_gdp_yy":   { eventId: 461,  name: "중국 GDP YoY" },
};

// ═══════════════════════════════════════════════════
// Yahoo Finance 수집
// ═══════════════════════════════════════════════════
async function fetchYahoo() {
  const results = {};
  const symbols = Object.entries(YAHOO_SYMBOLS);
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
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

// ═══════════════════════════════════════════════════
// 한국 국채 수익률 (ECOS)
// ═══════════════════════════════════════════════════
async function fetchKoreanBonds() {
  const apiKey = process.env.ECOS_API_KEY;
  if (!apiKey) return {};
  const results = {};
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, '');
  const startD = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const start = startD.toISOString().slice(0, 10).replace(/-/g, '');

  for (const [id, info] of Object.entries(ECOS_BONDS)) {
    try {
      const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/10/${info.table}/D/${start}/${end}/${info.item}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.RESULT?.CODE) continue;
      const rows = data?.StatisticSearch?.row;
      if (!rows || rows.length === 0) continue;
      const sorted = [...rows].sort((a, b) => a.TIME.localeCompare(b.TIME));
      const latest = sorted[sorted.length - 1];
      const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
      const value = parseFloat(latest.DATA_VALUE);
      if (isNaN(value)) continue;
      let change = null;
      if (prev) {
        const prevVal = parseFloat(prev.DATA_VALUE);
        if (!isNaN(prevVal)) {
          const diff = (value - prevVal).toFixed(2);
          change = diff > 0 ? `+${diff}%p` : diff < 0 ? `${diff}%p` : null;
        }
      }
      results[id] = { price: value.toFixed(3), change };
    } catch (e) {}
  }
  return results;
}

// ═══════════════════════════════════════════════════
// Investing.com 경제 지표 수집
// ═══════════════════════════════════════════════════

async function fetchSingleIndicator(eventId, limit = 5) {
  try {
    const url = `https://endpoints.investing.com/pd-instruments/v1/calendars/economic/events/${eventId}/occurrences?domain_id=18&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.occurrences || null;
  } catch (e) {
    return null;
  }
}

function parseOccurrences(occurrences) {
  if (!occurrences || occurrences.length === 0) return null;

  // 다음 발표 예정 (actual이 없는 첫 번째 항목)
  const upcoming = occurrences.find(o => o.actual === undefined || o.actual === null);
  // 과거 발표 (actual이 있는 항목들)
  const released = occurrences.filter(o => o.actual !== undefined && o.actual !== null);

  const records = released.map(o => ({
    date: o.occurrence_time?.slice(0, 10) || "",
    time: o.occurrence_time || "",
    actual: o.actual,
    forecast: o.forecast ?? null,
    previous: o.previous ?? null,
    surprise: o.actual_to_forecast || "neutral",
    period: o.reference_period || "",
  }));

  return {
    unit: occurrences[0]?.unit || "",
    next_date: upcoming?.occurrence_time?.slice(0, 10) || null,
    next_time: upcoming?.occurrence_time || null,
    next_forecast: upcoming?.forecast ?? null,
    next_previous: upcoming?.previous ?? null,
    records,
  };
}

async function fetchInvestingData(existingData) {
  const results = {};
  const errors = [];
  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date().getDay(); // 0=일요일
  const isFullScan = dayOfWeek === 0; // 일요일 = 전체 지표 풀스캔
  const isFirstRun = !existingData || Object.keys(existingData).length === 0;

  // 수집 대상 결정
  const toFetch = [];
  for (const [id, config] of Object.entries(INVESTING_EVENTS)) {
    if (isFirstRun) {
      // 첫 수집: 3년치 (36개)
      toFetch.push({ id, ...config, limit: 36 });
    } else if (isFullScan) {
      // 일요일 풀스캔: 최근 5개 (일정 변경 감지 + 안전장치)
      toFetch.push({ id, ...config, limit: 5 });
    } else {
      // 스마트 스케줄링: 발표 예정일 도래한 지표만
      const existing = existingData[id];
      if (!existing?.next_date) {
        toFetch.push({ id, ...config, limit: 5 });
      } else {
        const nextDate = new Date(existing.next_date);
        const todayDate = new Date(today);
        // 발표일이 오늘 이전이면 새 데이터가 있을 수 있음
        if (nextDate <= todayDate) {
          toFetch.push({ id, ...config, limit: 5 });
        }
      }
    }
  }

  // 순차적으로 수집 (rate limiting 방지, 200ms 간격)
  for (let i = 0; i < toFetch.length; i++) {
    const { id, eventId, limit } = toFetch[i];
    const occurrences = await fetchSingleIndicator(eventId, limit);

    if (occurrences) {
      const parsed = parseOccurrences(occurrences);
      if (parsed) {
        // 기존 데이터와 병합
        if (!isFirstRun && existingData?.[id]?.records) {
          const existingRecords = existingData[id].records;
          const newDates = new Set(parsed.records.map(r => r.date));
          const merged = [
            ...parsed.records,
            ...existingRecords.filter(r => !newDates.has(r.date))
          ];
          merged.sort((a, b) => b.date.localeCompare(a.date));
          parsed.records = merged.slice(0, 36); // 최대 36개 유지
        }
        results[id] = parsed;
      }
    } else {
      errors.push({ id, eventId, msg: "fetch failed" });
      // 실패 시 기존 데이터 유지
      if (existingData?.[id]) results[id] = existingData[id];
    }

    // 요청 간 200ms 딜레이
    if (i < toFetch.length - 1) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 수집 대상이 아닌 지표는 기존 데이터 그대로 유지
  if (existingData) {
    for (const id of Object.keys(INVESTING_EVENTS)) {
      if (!results[id] && existingData[id]) {
        results[id] = existingData[id];
      }
    }
  }

  return {
    data: results,
    errors,
    fetchedCount: toFetch.length,
    totalCount: Object.keys(INVESTING_EVENTS).length,
    isFirstRun,
    isFullScan,
  };
}

// ═══════════════════════════════════════════════════
// API Handler
// ?mode=market → Yahoo + 채권만 (수치갱신 버튼)
// ?mode=indicators → 경제지표만 (지표 업데이트 버튼)
// (기본) → 전부 (cron용, 스마트 스케줄링)
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {
  try {
    const mode = req.query?.mode || "all";
    const timestamp = new Date().toISOString();
    const dateKey = timestamp.slice(0, 10);

    // 기존 auto_data 읽기 (데이터 병합 + 스마트 스케줄링용)
    let existingRow = null;
    try {
      const { data } = await supabase
        .from('auto_data')
        .select('*')
        .order('date_key', { ascending: false })
        .limit(1)
        .single();
      existingRow = data;
    } catch (e) {}

    let yahoo = existingRow?.yahoo_data || {};
    let investingResult = {
      data: existingRow?.investing_data || {},
      errors: [], fetchedCount: 0, totalCount: Object.keys(INVESTING_EVENTS).length,
    };

    // === 시장 데이터 수집 (Yahoo + 한국 국채) ===
    if (mode === "all" || mode === "market") {
      const [yahooData, krBonds] = await Promise.all([
        fetchYahoo(),
        fetchKoreanBonds(),
      ]);
      yahoo = yahooData;
      Object.assign(yahoo, krBonds);
    }

    // === 경제 지표 수집 (Investing.com) ===
    if (mode === "all" || mode === "indicators") {
      investingResult = await fetchInvestingData(existingRow?.investing_data || null);
    }

    // === Supabase 저장 ===
    const { error } = await supabase
      .from('auto_data')
      .upsert({
        date_key: dateKey,
        yahoo_data: yahoo,
        investing_data: investingResult.data,
        fetched_at: timestamp,
      }, { onConflict: 'date_key' });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      mode,
      date: dateKey,
      counts: {
        yahoo: Object.keys(yahoo).length,
        indicators_fetched: investingResult.fetchedCount,
        indicators_total: investingResult.totalCount,
      },
      isFirstRun: investingResult.isFirstRun || false,
      isFullScan: investingResult.isFullScan || false,
      investingErrors: investingResult.errors?.length > 0 ? investingResult.errors : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
