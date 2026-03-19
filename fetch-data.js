import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ═══ Yahoo Finance — 증시 + 채권 + 원자재 + 환율 ═══
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

// ═══ FRED — 미국/유럽/일본/한국 지표 ═══
// units: lin=원래값, pc1=전년동기비%, pch=전기대비%, chg=전기대비변동
const FRED_SERIES = {
  // 금리
  "us_rate":     { id: "DFEDTARU", units: "lin" },       // 연준 목표금리 상단
  "eu_rate":     { id: "ECBMRRFR", units: "lin" },       // ECB 기준금리
  "jp_rate":     { id: "IRSTCB01JPM156N", units: "lin" },// 일본은행 정책금리
  "us2y_yield":  { id: "DGS2", units: "lin" },           // 미국 2년물 금리

  // 물가 — 미국 (전년동기대비 %)
  "us_cpi":      { id: "CPIAUCSL", units: "pc1" },       // CPI YoY%
  "us_core_cpi": { id: "CPILFESL", units: "pc1" },       // 근원 CPI YoY%
  "us_pce":      { id: "PCEPI", units: "pc1" },          // PCE YoY%
  "us_core_pce": { id: "PCEPILFE", units: "pc1" },       // 근원 PCE YoY%
  "us_ppi":      { id: "PPIFIS", units: "pc1" },         // PPI 최종수요 YoY%

  // 물가 — 일본/유로/한국 (이미 YoY%인 시리즈 사용)
  "jp_cpi":      { id: "FPCPITOTLZGJPN", units: "lin" }, // 일본 CPI YoY% (이미 %)
  "eu_cpi":      { id: "FPCPITOTLZGEMU", units: "lin" }, // 유로존 CPI YoY% (이미 %)
  "kr_cpi_fred": { id: "FPCPITOTLZGKOR", units: "lin" }, // 한국 CPI YoY% (이미 %)

  // 경기
  "us_retail":   { id: "RSAFS", units: "pch" },          // 소매판매 MoM%

  // 고용
  "us_unemp":    { id: "UNRATE", units: "lin" },         // 미국 실업률 %
  "us_nfp":      { id: "PAYEMS", units: "chg" },         // 비농업고용 변동(천명)
  "us_claims":   { id: "ICSA", units: "lin" },           // 실업수당 청구(건)
  "us_jolts":    { id: "JTSJOL", units: "lin" },         // JOLTS 구인건수(천건)
};

// ISM PMI는 FRED에 신뢰할 수 있는 시리즈가 없음 → 수동 입력

// FRED 발표일 조회용 Release ID
const FRED_RELEASES = {
  "us_cpi": 10, "us_core_cpi": 10, "us_ppi": 11,
  "us_pce": 54, "us_core_pce": 54,
  "us_nfp": 50, "us_unemp": 50,
  "us_retail": 13, "us_claims": 176,
  "us_jolts": 110,
};

// ═══ ECOS — 한국 지표 (FRED에 없거나 지연되는 것) ═══
// FRED의 한국 데이터는 3~6개월 지연 → 한국은행 ECOS에서 직접 가져오기
const ECOS_SERIES = {
  // 근원물가 (식료품·에너지 제외 소비자물가지수)
  "kr_core_cpi": { table: "901Y010", item: "QB", freq: "M", yoy: true },
  // 한국 CPI 총지수 (FRED보다 빠름)
  "kr_cpi_ecos": { table: "901Y009", item: "0", freq: "M", yoy: true },
  // 한국 기준금리
  "kr_rate_ecos": { table: "722Y001", item: "0101000", freq: "M", yoy: false },
  // 한국 생산자물가지수 (총지수)
  "kr_ppi_ecos": { table: "404Y014", item: "*AA", freq: "M", yoy: true },
  // 한국 실업률 (경제활동인구조사)
  "kr_unemp_ecos": { table: "901Y027", item: "I11", freq: "M", yoy: false },
};

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

async function fetchFred() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return {};
  const results = {};
  // 최근 2년 데이터만 조회 (오래된 데이터 방지)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const obsStart = twoYearsAgo.toISOString().slice(0, 10);

  for (const [id, cfg] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${cfg.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=10&units=${cfg.units}&observation_start=${obsStart}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const obs = (data?.observations || []).filter(o => o.value !== ".").slice(0, 5);
      if (obs.length > 0) {
        results[id] = obs.map(o => ({
          value: parseFloat(o.value).toFixed(2),
          date: o.date
        }));
      }
    } catch (e) {}
  }
  return results;
}

async function fetchFredReleaseDates() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return {};
  const results = {};
  const today = new Date().toISOString().slice(0, 10);
  // 3개월 후까지 조회
  const future = new Date();
  future.setMonth(future.getMonth() + 3);
  const futureStr = future.toISOString().slice(0, 10);
  const fetched = {};
  for (const [indId, relId] of Object.entries(FRED_RELEASES)) {
    if (fetched[relId]) { results[indId] = fetched[relId]; continue; }
    try {
      const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${relId}&api_key=${apiKey}&file_type=json&realtime_start=${today}&realtime_end=${futureStr}&include_release_dates_with_no_data=true&sort_order=asc&limit=3`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const dates = data?.release_dates || [];
      if (dates.length > 0) {
        fetched[relId] = { date: dates[0].date, source: "fred" };
        results[indId] = fetched[relId];
      }
    } catch (e) {}
  }
  return results;
}

async function fetchEcos() {
  const apiKey = process.env.ECOS_API_KEY;
  if (!apiKey) return { _error: "ECOS_API_KEY not set" };
  const results = {};
  const errors = [];
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const q = Math.ceil((now.getMonth() + 1) / 3);

  for (const [id, info] of Object.entries(ECOS_SERIES)) {
    try {
      const freq = info.freq || 'M';
      let startDate, endDate, limit;

      if (freq === 'Q') {
        startDate = `${y - 3}Q1`;
        endDate = `${y}Q${q}`;
        limit = 15;
      } else {
        startDate = `${y - 2}${m}`;
        endDate = `${y}${m}`;
        limit = info.yoy ? 30 : 5;
      }

      const url = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/${limit}/${info.table}/${freq}/${startDate}/${endDate}/${info.item}`;
      const res = await fetch(url);
      if (!res.ok) { errors.push({ id, status: res.status }); continue; }
      const data = await res.json();

      // ECOS error response check
      if (data?.RESULT?.CODE) {
        errors.push({ id, code: data.RESULT.CODE, msg: data.RESULT.MESSAGE });
        continue;
      }

      const rows = data?.StatisticSearch?.row;
      if (!rows || rows.length === 0) { errors.push({ id, msg: "no rows" }); continue; }

      if (info.yoy) {
        const sorted = [...rows].sort((a, b) => a.TIME.localeCompare(b.TIME));
        const yoyResults = [];
        for (let i = 0; i < sorted.length; i++) {
          const currTime = sorted[i].TIME;
          const prevYear = parseInt(currTime.slice(0, 4)) - 1;
          const prevTime = `${prevYear}${currTime.slice(4)}`;
          const prevRow = sorted.find(r => r.TIME === prevTime);
          if (prevRow) {
            const curr = parseFloat(sorted[i].DATA_VALUE);
            const prev = parseFloat(prevRow.DATA_VALUE);
            if (curr && prev) {
              yoyResults.push({ value: ((curr / prev - 1) * 100).toFixed(2), date: currTime });
            }
          }
        }
        if (yoyResults.length > 0) results[id] = yoyResults.slice(-5);
        else errors.push({ id, msg: "yoy calc failed", rowCount: rows.length });
      } else {
        const sorted = [...rows].sort((a, b) => a.TIME.localeCompare(b.TIME));
        results[id] = sorted.slice(-5).map(r => ({ value: r.DATA_VALUE, date: r.TIME }));
      }
    } catch (e) {
      errors.push({ id, error: e.message });
    }
  }
  if (errors.length > 0) results._ecos_errors = errors;
  return results;
}

export default async function handler(req, res) {
  try {
    const timestamp = new Date().toISOString();
    const dateKey = timestamp.slice(0, 10);
    const [yahoo, fred, fredDates, ecos] = await Promise.all([
      fetchYahoo(), fetchFred(), fetchFredReleaseDates(), fetchEcos(),
    ]);
    // 미국 2년물: FRED에서 가져온 값을 yahoo 형식으로 변환하여 대시보드에서 읽을 수 있게
    if (fred.us2y_yield && fred.us2y_yield.length > 0) {
      const latest = fred.us2y_yield[0];
      const prev = fred.us2y_yield.length > 1 ? fred.us2y_yield[1] : null;
      const chg = prev ? (parseFloat(latest.value) - parseFloat(prev.value)).toFixed(2) : null;
      yahoo.us2y = { price: latest.value, change: chg ? (chg > 0 ? `+${chg}%` : `${chg}%`) : null };
    }
    // 실업수당 청구: FRED는 건수(205000) 반환 → 천건 단위(205)로 변환
    if (fred.us_claims) {
      fred.us_claims = fred.us_claims.map(o => ({ ...o, value: (parseFloat(o.value) / 1000).toFixed(0) }));
    }

    // ═══ 한국 데이터: ECOS(직접) vs FRED(지연) 비교 → 더 최신 데이터 사용 ═══
    const getLatestDate = (arr) => arr && arr.length > 0 ? arr[arr.length - 1]?.date || arr[0]?.date || "" : "";

    // ECOS → 프론트엔드 ID 매핑
    const ecosMappings = {
      "kr_cpi_ecos": "kr_cpi",
      "kr_rate_ecos": "kr_rate",
      "kr_ppi_ecos": "kr_ppi",
      "kr_unemp_ecos": "kr_unemp",
    };
    for (const [ecosKey, frontendKey] of Object.entries(ecosMappings)) {
      if (ecos[ecosKey]) {
        ecos[frontendKey] = ecos[ecosKey];
        delete ecos[ecosKey];
      }
    }

    // FRED 한국 CPI vs ECOS 한국 CPI: 더 최신인 것을 사용
    const fredKrCpiDate = getLatestDate(fred.kr_cpi_fred);
    const ecosKrCpiDate = getLatestDate(ecos.kr_cpi);
    if (ecosKrCpiDate >= fredKrCpiDate && ecos.kr_cpi) {
      // ECOS가 더 최신 → ECOS 데이터를 fred.kr_cpi에도 복사 (프론트엔드 호환)
      fred.kr_cpi = ecos.kr_cpi;
    } else if (fred.kr_cpi_fred) {
      fred.kr_cpi = fred.kr_cpi_fred;
    }
    const { error } = await supabase
      .from('auto_data')
      .upsert({ date_key: dateKey, yahoo_data: yahoo, fred_data: fred, ecos_data: ecos, release_dates: fredDates, fetched_at: timestamp }, { onConflict: 'date_key' });
    if (error) return res.status(500).json({ error: error.message });

    // 신선도 요약 생성
    const freshnessSummary = {};
    const today = new Date();
    const checkFreshness = (source, id, data) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      const latestDate = data[0]?.date || data[data.length - 1]?.date;
      if (!latestDate) return;
      const diffDays = Math.floor((today - new Date(latestDate)) / 86400000);
      if (diffDays > 60) freshnessSummary[id] = { source, latestDate, daysOld: diffDays, status: "stale" };
      else if (diffDays > 30) freshnessSummary[id] = { source, latestDate, daysOld: diffDays, status: "aging" };
    };
    for (const [id, data] of Object.entries(fred)) { if (Array.isArray(data)) checkFreshness("fred", id, data); }
    for (const [id, data] of Object.entries(ecos)) { if (Array.isArray(data)) checkFreshness("ecos", id, data); }

    return res.status(200).json({
      success: true, date: dateKey,
      counts: { yahoo: Object.keys(yahoo).length, fred: Object.keys(fred).length, fredDates: Object.keys(fredDates).length, ecos: Object.keys(ecos).length },
      ecosErrors: ecos._ecos_errors || null,
      staleIndicators: Object.keys(freshnessSummary).length > 0 ? freshnessSummary : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
