import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const MARKET_INDICES = [
  { country: "us", flag: "\u{1f1fa}\u{1f1f8}", name: "미국", indices: [
    { id: "sp500", label: "S&P 500", default: true, url: "https://kr.investing.com/indices/us-spx-500" },
    { id: "nasdaq", label: "나스닥", default: true, url: "https://kr.investing.com/indices/nasdaq-composite" },
    { id: "dow", label: "다우존스", default: false, url: "https://kr.investing.com/indices/us-30" },
    { id: "russell", label: "러셀 2000", default: false, url: "https://kr.investing.com/indices/smallcap-2000" },
    { id: "sox", label: "필라델피아 반도체", default: false, url: "https://kr.investing.com/indices/phlx-semiconductor" },
  ]},
  { country: "jp", flag: "\u{1f1ef}\u{1f1f5}", name: "일본", indices: [
    { id: "nikkei", label: "닛케이 225", default: true, url: "https://kr.investing.com/indices/japan-ni225" },
    { id: "topix", label: "TOPIX", default: false, url: "https://kr.investing.com/indices/topix" },
  ]},
  { country: "kr", flag: "\u{1f1f0}\u{1f1f7}", name: "한국", indices: [
    { id: "kospi", label: "코스피", default: true, url: "https://kr.investing.com/indices/kospi" },
    { id: "kosdaq", label: "코스닥", default: true, url: "https://kr.investing.com/indices/kosdaq" },
    { id: "kospi200", label: "코스피 200", default: false, url: "https://kr.investing.com/indices/kospi-200" },
  ]},
  { country: "cn", flag: "\u{1f1e8}\u{1f1f3}", name: "중국", indices: [
    { id: "shanghai", label: "상해종합", default: true, url: "https://kr.investing.com/indices/shanghai-composite" },
    { id: "shenzhen", label: "심천종합", default: true, url: "https://kr.investing.com/indices/szse-component" },
    { id: "chinext", label: "차이넥스트", default: false, url: "https://kr.investing.com/indices/chinext-price" },
    { id: "hang", label: "항셍지수", default: false, url: "https://kr.investing.com/indices/hang-sen-40" },
  ]},
  { country: "tw", flag: "\u{1f1f9}\u{1f1fc}", name: "대만", indices: [
    { id: "taiex", label: "가권지수", default: true, url: "https://kr.investing.com/indices/taiwan-weighted" },
  ]},
];

const ALL_INDEX_IDS = MARKET_INDICES.flatMap((m) => m.indices.map((idx) => idx.id));
const ALL_INDEX_MAP = {};
MARKET_INDICES.forEach((m) => m.indices.forEach((idx) => { ALL_INDEX_MAP[idx.id] = idx; }));

const CATEGORIES = [
  { id: "market", label: "국가별 증시", icon: "globe" },
  { id: "bond", label: "채권", icon: "bond" },
  { id: "fx", label: "환율", icon: "trending" },
  { id: "commodity", label: "원자재/가상화폐", icon: "commodity" },
  { id: "sector", label: "섹터별 분석", icon: "layers" },
  { id: "stock", label: "종목별 분석", icon: "trending" },
];

const BOND_ITEMS = [
  { id: "us10y", name: "미국 10년물", flag: "\u{1f1fa}\u{1f1f8}", url: "https://kr.investing.com/rates-bonds/u.s.-10-year-bond-yield", auto: true },
  { id: "us2y", name: "미국 2년물", flag: "\u{1f1fa}\u{1f1f8}", url: "https://kr.investing.com/rates-bonds/u.s.-2-year-bond-yield", auto: true },
  { id: "kr10y", name: "한국 10년물", flag: "\u{1f1f0}\u{1f1f7}", url: "https://kr.investing.com/rates-bonds/south-korea-10-year-bond-yield", auto: true },
  { id: "kr3y", name: "한국 3년물", flag: "\u{1f1f0}\u{1f1f7}", url: "https://kr.investing.com/rates-bonds/south-korea-3-year-bond-yield", auto: true },
];

const COMMODITY_ITEMS = [
  { id: "gold", name: "금 (Gold)", category: "금속", url: "https://kr.investing.com/commodities/gold" },
  { id: "silver", name: "은 (Silver)", category: "금속", url: "https://kr.investing.com/commodities/silver" },
  { id: "oil", name: "WTI 원유", category: "원자재", url: "https://kr.investing.com/commodities/crude-oil" },
  { id: "natgas", name: "천연가스", category: "원자재", url: "https://kr.investing.com/commodities/natural-gas" },
  { id: "btc", name: "비트코인", category: "가상화폐", url: "https://kr.investing.com/crypto/bitcoin" },
  { id: "eth", name: "이더리움", category: "가상화폐", url: "https://kr.investing.com/crypto/ethereum" },
];

const FX_ITEMS = [
  { id: "usdkrw", name: "달러/원 (USD/KRW)", url: "https://kr.investing.com/currencies/usd-krw" },
  { id: "usdjpy", name: "달러/엔 (USD/JPY)", url: "https://kr.investing.com/currencies/usd-jpy" },
  { id: "dxy", name: "달러인덱스 (DXY)", url: "https://kr.investing.com/indices/usdollar" },
];

const emptyEntry = () => ({
  markets: MARKET_INDICES.flatMap((m) => m.indices.filter((idx) => idx.default).map((idx) => ({ id: idx.id, country: m.country, value: "", change: "" }))),
  marketNotes: MARKET_INDICES.reduce((acc, m) => { acc[m.country] = { reason: "", outlook: "" }; return acc; }, {}),
  customIndices: [],
  bonds: BOND_ITEMS.map((b) => ({ id: b.id, yield: "", change: "", reason: "" })),
  fx: FX_ITEMS.map((f) => ({ id: f.id, rate: "", change: "" })),
  commodities: COMMODITY_ITEMS.map((c) => ({ id: c.id, price: "", change: "", reason: "" })),
  commodityOutlook: "",
  bondOutlook: "",
  fxOutlook: "",
  sectors: [{ id: Date.now(), name: "", change: "", reason: "", outlook: "" }],
  stocks: [{ id: Date.now() + 1, name: "", ticker: "", price: "", change: "", reason: "", outlook: "" }],
  memo: "",
});

const formatDate = (d) => {
  const date = new Date(d);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
};

const toKey = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const hasContent = (entry) => {
  if (!entry) return false;
  if (entry.memo) return true;
  if (entry.markets?.some((m) => m.value || m.change)) return true;
  if (entry.marketNotes && Object.values(entry.marketNotes).some((n) => n.reason || n.outlook)) return true;
  if (entry.bonds?.some((b) => b.yield || b.change)) return true;
  if (entry.commodities?.some((c) => c.price || c.change)) return true;
  if (entry.sectors?.some((s) => s.name)) return true;
  if (entry.stocks?.some((s) => s.name)) return true;
  return false;
};

const getEntryStats = (entry) => {
  if (!entry) return null;
  const marketsWritten = entry.markets?.filter((m) => m.value || m.change).length || 0;
  const bondsWritten = entry.bonds?.filter((b) => b.yield || b.change).length || 0;
  const commoditiesWritten = entry.commodities?.filter((c) => c.price || c.change).length || 0;
  const sectorsWritten = entry.sectors?.filter((s) => s.name).length || 0;
  const stocksWritten = entry.stocks?.filter((s) => s.name).length || 0;
  return { marketsWritten, bondsWritten, commoditiesWritten, sectorsWritten, stocksWritten };
};

const Icons = {
  globe: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  layers: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  trending: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  file: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  chevLeft: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevRight: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  save: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  copy: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  barChart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  grid: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  bond: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="6" x2="6" y2="18"/><line x1="18" y1="6" x2="18" y2="18"/></svg>,
  commodity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8"/><path d="M9 10h6"/><path d="M9 14h6"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bookmark: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  link: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  extLink: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  activity: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
};

const STORAGE_KEY = "journal-entries";
const SCRAP_KEY = "news-scraps";
const INDICATOR_KEY = "eco-indicators";
const REPORT_KEY = "report-archive";
const LINKS_KEY = "routine-links";

const REPORT_SOURCES = [
  { id: "samsung", label: "삼성증권" }, { id: "mirae", label: "미래에셋" }, { id: "kb", label: "KB증권" },
  { id: "nh", label: "NH투자" }, { id: "hana", label: "하나증권" }, { id: "shinhan", label: "신한투자" },
  { id: "kiwoom", label: "키움증권" }, { id: "daishin", label: "대신증권" }, { id: "hanwha", label: "한화투자" },
  { id: "other", label: "기타" },
];

const DEFAULT_REPORT_SECTORS = [
  { id: "semi", label: "반도체" }, { id: "battery", label: "2차전지" }, { id: "bio", label: "바이오" },
  { id: "auto", label: "자동차" }, { id: "it", label: "IT/SW" }, { id: "finance", label: "금융" },
  { id: "energy", label: "에너지" }, { id: "consumer", label: "소비재" }, { id: "industrial", label: "산업재" },
  { id: "realestate", label: "부동산/건설" }, { id: "macro", label: "매크로/경제" }, { id: "other", label: "기타" },
];

const SCRAP_CATEGORIES = [
  { id: "securities", label: "증권", color: "#3B6FF5" },
  { id: "banking", label: "은행", color: "#0E9F6E" },
  { id: "economy", label: "경제/금융", color: "#E8590C" },
  { id: "realestate", label: "부동산", color: "#9333EA" },
  { id: "tech", label: "IT/테크", color: "#0891B2" },
  { id: "industry", label: "산업/기업", color: "#CA8A04" },
  { id: "crypto", label: "가상화폐", color: "#E02D3C" },
  { id: "other", label: "기타", color: "#6B7280" },
];

/* main */
export default function InvestmentJournal({ onLogout, userEmail } = {}) {
  const [entries, setEntries] = useState({});
  const [scraps, setScraps] = useState([]);
  const [indicators, setIndicators] = useState({});
  const [reports, setReports] = useState([]);
  const [customSectors, setCustomSectors] = useState([]);
  const [routineLinks, setRoutineLinks] = useState([]);
  const [autoData, setAutoData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showDataMgr, setShowDataMgr] = useState(false);
  const [storageAlert, setStorageAlert] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toKey(new Date()));
  const [activeTab, setActiveTab] = useState("market");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState("daily");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewWeekStart, setViewWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return toKey(new Date(d.getFullYear(), d.getMonth(), diff));
  });

  useEffect(() => {
    (async () => {
      try {
        const r1 = await window.storage.get(STORAGE_KEY);
        if (r1 && r1.value) setEntries(JSON.parse(r1.value));
      } catch (e) {}
      try {
        const r2 = await window.storage.get(SCRAP_KEY);
        if (r2 && r2.value) setScraps(JSON.parse(r2.value));
      } catch (e) {}
      try {
        const r3 = await window.storage.get(INDICATOR_KEY);
        if (r3 && r3.value) setIndicators(JSON.parse(r3.value));
      } catch (e) {}
      try {
        const r4 = await window.storage.get(REPORT_KEY);
        if (r4 && r4.value) {
          const parsed = JSON.parse(r4.value);
          if (Array.isArray(parsed)) { setReports(parsed); } 
          else { setReports(parsed.items || []); setCustomSectors(parsed.customSectors || []); }
        }
      } catch (e) {}
      try {
        const r5 = await window.storage.get(LINKS_KEY);
        if (r5 && r5.value) setRoutineLinks(JSON.parse(r5.value));
      } catch (e) {}
      try {
        if (window.getLatestAutoData) {
          const ad = await window.getLatestAutoData();
          if (ad) setAutoData(ad);
        }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  // Legacy data cleanup removed — no longer using FRED/ECOS

  const getStorageSize = useCallback(() => {
    const sizes = {
      entries: JSON.stringify(entries).length,
      scraps: JSON.stringify(scraps).length,
      indicators: JSON.stringify(indicators).length,
      reports: JSON.stringify(reports).length,
      links: JSON.stringify(routineLinks).length,
      sectors: JSON.stringify(customSectors).length,
      autoData: autoData ? JSON.stringify(autoData).length : 0,
    };
    sizes.total = Object.values(sizes).reduce((a, b) => a + b, 0);
    return sizes;
  }, [entries, scraps, indicators, reports, routineLinks, customSectors, autoData]);

  useEffect(() => {
    if (!loaded) return;
    const sizes = getStorageSize();
    const totalMB = sizes.total / 1024 / 1024;
    if (totalMB > 400) setStorageAlert("danger");
    else if (totalMB > 300) setStorageAlert("warning");
    else setStorageAlert(null);
  }, [loaded, entries, scraps, indicators, reports]);

  const showToast = (msg, dur = 1800) => { setToast(msg); setTimeout(() => setToast(null), dur); };

  const currentEntry = entries[selectedDate] || emptyEntry();

  const updateEntry = useCallback((updater) => {
    setEntries((prev) => {
      const current = prev[selectedDate] || emptyEntry();
      const updated = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedDate]: updated };
    });
  }, [selectedDate]);

  const saveAll = async () => {
    setSaving(true);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(entries));
      await window.storage.set(SCRAP_KEY, JSON.stringify(scraps));
      await window.storage.set(INDICATOR_KEY, JSON.stringify(indicators));
      await window.storage.set(REPORT_KEY, JSON.stringify({ items: reports, customSectors }));
      if (routineLinks.length > 0) await window.storage.set(LINKS_KEY, JSON.stringify(routineLinks));
      showToast("저장 완료");
      setLastSaved(new Date());
    } catch (e) { showToast("저장 실패 — 다시 시도해주세요", 2500); }
    setSaving(false);
  };

  const navigateDate = (dir) => { const d = new Date(selectedDate); d.setDate(d.getDate() + dir); setSelectedDate(toKey(d)); };

  const copyPrev = () => {
    const d = new Date(selectedDate); d.setDate(d.getDate() - 1);
    const prevKey = toKey(d);
    if (entries[prevKey]) {
      const deep = JSON.parse(JSON.stringify(entries[prevKey]));
      deep.markets.forEach((m) => { m.change = ""; });
      if (deep.marketNotes) Object.values(deep.marketNotes).forEach((n) => { n.reason = ""; });
      if (deep.bonds) deep.bonds.forEach((b) => { b.change = ""; b.reason = ""; });
      if (deep.commodities) deep.commodities.forEach((c) => { c.change = ""; c.reason = ""; });
      deep.memo = "";
      updateEntry(deep);
      showToast("전일 데이터 복사됨");
    } else { showToast("전일 데이터 없음"); }
  };

  const goToDate = (dateKey) => { setSelectedDate(dateKey); setViewMode("daily"); };

  if (!loaded) return (
    <div style={S.loadWrap}><div style={S.loadSpin} /><p style={S.loadText}>데이터 불러오는 중...</p></div>
  );

  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {toast && <div style={S.toast}>{toast}</div>}

      <header style={S.header}>
        <div style={S.headerLeft} onClick={() => setPage("dashboard")} role="button" tabIndex={0}>
          <div style={S.logoMark}>IN</div>
          <div>
            <h1 style={S.title}>투자 노트</h1>
            <p style={S.subtitle}>Investment Note</p>
          </div>
        </div>
        <div style={S.headerActions}>
          {userEmail === "younjino8755@gmail.com" && (
            <button style={{ ...S.logoutBtn, color: C.up, borderColor: C.up + "40" }} onClick={async () => {
              showToast("이전 수집 데이터 정리 중...");
              try {
                if (window.clearAutoData) await window.clearAutoData();
                showToast("최신 시장 수치 가져오는 중...");
                const res = await fetch("/api/fetch-data?mode=market");
                const data = await res.json();
                if (data.success) {
                  if (window.getLatestAutoData) {
                    const ad = await window.getLatestAutoData();
                    if (ad) setAutoData(ad);
                  }
                  showToast("시장 수치 갱신 완료!");
                } else { showToast("오류: " + (data.error || "실패")); }
              } catch (e) { showToast("네트워크 오류"); }
            }} title="시장 데이터 수집 (증시/채권/환율/원자재)">수치 갱신</button>
          )}
          {userEmail === "younjino8755@gmail.com" && (
            <button style={{ ...S.logoutBtn, color: "#E8590C", borderColor: "#E8590C40" }} onClick={async () => {
              showToast("경제 지표 수집 중... (최대 1분 소요)");
              try {
                const res = await fetch("/api/fetch-data?mode=indicators");
                const data = await res.json();
                if (data.success) {
                  if (window.getLatestAutoData) {
                    const ad = await window.getLatestAutoData();
                    if (ad) setAutoData(ad);
                  }
                  showToast(`지표 업데이트 완료! (${data.counts?.indicators_fetched || 0}/${data.counts?.indicators_total || 0}개 수집${data.isFirstRun ? " — 첫 수집" : ""})`);
                } else { showToast("오류: " + (data.error || "실패")); }
              } catch (e) { showToast("네트워크 오류"); }
            }} title="경제 지표 수집 (Investing.com)">지표 갱신</button>
          )}
          {onLogout && <button style={S.logoutBtn} onClick={onLogout} title={userEmail}>로그아웃</button>}
          <button style={{ ...S.logoutBtn, fontSize: 10 }} onClick={() => setShowDataMgr(true)} title="데이터 관리">{Icons.layers}</button>
        </div>
      </header>

      {storageAlert && (
        <div style={{ padding: "8px 14px", borderRadius: 8, marginTop: 8, fontSize: 11, fontWeight: 600, textAlign: "center",
          background: storageAlert === "danger" ? C.downBg : "#F59E0B10",
          color: storageAlert === "danger" ? C.down : "#F59E0B",
          border: `1px solid ${storageAlert === "danger" ? C.down + "30" : "#F59E0B30"}`,
        }}>
          {storageAlert === "danger" ? "⚠️ 저장 용량이 거의 다 찼습니다 (400MB+). 데이터 관리에서 불필요한 데이터를 삭제해주세요." : "💾 저장 용량이 300MB를 넘었습니다. 데이터 관리를 확인해주세요."}
          <button style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", fontSize: 11, fontFamily: C.sans, marginLeft: 6 }} onClick={() => setShowDataMgr(true)}>데이터 관리 열기</button>
        </div>
      )}

      {showDataMgr && <DataManager entries={entries} setEntries={setEntries} scraps={scraps} setScraps={setScraps} indicators={indicators} setIndicators={setIndicators} reports={reports} setReports={setReports} getStorageSize={getStorageSize} showToast={showToast} setAutoData={setAutoData} autoData={autoData} onClose={() => setShowDataMgr(false)} />}

      {/* Page Toggle */}
      <div style={S.pageToggleBar}>
        <button style={{ ...S.pageToggleBtn, ...(page === "dashboard" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("dashboard")}>
          {Icons.home}<span>대시보드</span>
        </button>
        <button style={{ ...S.pageToggleBtn, ...(page === "top10" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("top10")}>
          {Icons.trending}<span>거래대금TOP10</span>
        </button>
        <button style={{ ...S.pageToggleBtn, ...(page === "journal" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("journal")}>
          {Icons.edit}<span>투자 일지</span>
        </button>
        <button style={{ ...S.pageToggleBtn, ...(page === "scrap" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("scrap")}>
          {Icons.bookmark}<span>신문 스크랩</span>
          {scraps.length > 0 && <span style={S.scrapCount}>{scraps.length}</span>}
        </button>
        <button style={{ ...S.pageToggleBtn, ...(page === "indicators" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("indicators")}>
          {Icons.activity}<span>경제 지표</span>
        </button>
        <button style={{ ...S.pageToggleBtn, ...(page === "reports" ? S.pageToggleBtnActive : {}) }} onClick={() => setPage("reports")}>
          {Icons.file}<span>레포트</span>
          {reports.length > 0 && <span style={S.scrapCount}>{reports.length}</span>}
        </button>
      </div>

      {page === "dashboard" && <DashboardPage setPage={setPage} entries={entries} scraps={scraps} reports={reports} indicators={indicators} routineLinks={routineLinks} setRoutineLinks={setRoutineLinks} saveAll={saveAll} autoData={autoData} setAutoData={setAutoData} />}

      {page === "top10" && <Top10Page autoData={autoData} showToast={showToast} />}

      {page === "journal" && (<>
      <div style={S.viewToggleBar}>
        {[{ id: "daily", label: "일별", icon: Icons.edit }, { id: "weekly", label: "주별", icon: Icons.barChart }, { id: "monthly", label: "월별", icon: Icons.grid }].map((mode) => (
          <button key={mode.id} style={{ ...S.viewToggleBtn, ...(viewMode === mode.id ? S.viewToggleBtnActive : {}) }} onClick={() => setViewMode(mode.id)}>
            {mode.icon}<span>{mode.label}</span>
          </button>
        ))}
      </div>

      {viewMode === "daily" && (<>
        <div style={S.dateBar}>
          <button style={S.dateArrow} onClick={() => navigateDate(-1)}>{Icons.chevLeft}</button>
          <div style={S.dateCenter} onClick={() => document.getElementById('datePicker').showPicker?.() || document.getElementById('datePicker').focus()}>
            {Icons.calendar}
            <span style={S.dateText}>{formatDate(selectedDate)}</span>
            {selectedDate === toKey(new Date()) && <span style={S.todayBadge}>오늘</span>}
            <input id="datePicker" type="date" value={selectedDate} onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }} style={S.hiddenDateInput} />
          </div>
          <button style={S.dateArrow} onClick={() => navigateDate(1)}>{Icons.chevRight}</button>
        </div>
        <div style={S.quickActions}>
          <button style={S.quickBtn} onClick={copyPrev}>{Icons.copy} 전일 데이터 복사</button>
          <button style={S.quickBtn} onClick={() => setSelectedDate(toKey(new Date()))}>{Icons.calendar} 오늘로 이동</button>
        </div>
        <nav style={S.tabs}>
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setActiveTab(cat.id)} style={{ ...S.tab, ...(activeTab === cat.id ? S.tabActive : {}) }}>
              {Icons[cat.icon]}<span>{cat.label}</span>
            </button>
          ))}
        </nav>
        <main style={S.main}>
          {activeTab === "market" && <MarketSection entry={currentEntry} updateEntry={updateEntry} autoData={autoData} />}
          {activeTab === "bond" && <BondSection entry={currentEntry} updateEntry={updateEntry} autoData={autoData} />}
          {activeTab === "fx" && <FxSection entry={currentEntry} updateEntry={updateEntry} autoData={autoData} />}
          {activeTab === "commodity" && <CommoditySection entry={currentEntry} updateEntry={updateEntry} autoData={autoData} />}
          {activeTab === "sector" && <SectorSection entry={currentEntry} updateEntry={updateEntry} />}
          {activeTab === "stock" && <StockSection entry={currentEntry} updateEntry={updateEntry} autoData={autoData} />}
          <div style={S.memoSection}>
            <label style={S.memoLabel}>오늘의 메모 / 총평</label>
            <textarea style={S.memoArea} rows={3} placeholder="오늘 시장에 대한 총평, 내일 주시할 점 등..." value={currentEntry.memo || ""} onChange={(e) => updateEntry((prev) => ({ ...prev, memo: e.target.value }))} />
          </div>
          <div style={{ position: "sticky", bottom: 0, padding: "12px 0", background: `linear-gradient(transparent, ${C.bg} 20%)`, zIndex: 5 }}>
            <button style={{ ...S.saveBtn, width: "100%", justifyContent: "center", padding: "12px 0", borderRadius: 6, fontSize: 13, opacity: saving ? 0.6 : 1, background: (lastSaved && (new Date() - lastSaved) < 3000) ? C.up : C.accent }} onClick={saveAll} disabled={saving}>
              {Icons.save}<span>{saving ? "저장 중..." : (lastSaved && (new Date() - lastSaved) < 3000) ? "저장 완료 ✓" : "투자 일지 저장"}</span>
            </button>
          </div>
        </main>
      </>)}

      {viewMode === "weekly" && <WeeklyView entries={entries} viewWeekStart={viewWeekStart} setViewWeekStart={setViewWeekStart} goToDate={goToDate} />}
      {viewMode === "monthly" && <MonthlyView entries={entries} viewYear={viewYear} viewMonth={viewMonth} setViewYear={setViewYear} setViewMonth={setViewMonth} goToDate={goToDate} />}
      </>)}

      {page === "scrap" && <ScrapPage scraps={scraps} setScraps={setScraps} showToast={showToast} />}

      {page === "indicators" && <IndicatorsPage indicators={indicators} setIndicators={setIndicators} showToast={showToast} autoData={autoData} />}

      {page === "reports" && <ReportArchivePage reports={reports} setReports={setReports} customSectors={customSectors} setCustomSectors={setCustomSectors} showToast={showToast} />}

      <footer style={S.footer}><span>투자 노트</span><span style={S.footerDot} /><span>저장 버튼으로 데이터 보관</span></footer>
    </div>
  );
}

/* ═══ WEEKLY VIEW ═══ */
function WeeklyView({ entries, viewWeekStart, setViewWeekStart, goToDate }) {
  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(viewWeekStart);
    for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(toKey(d)); }
    return days;
  }, [viewWeekStart]);

  const navigateWeek = (dir) => { const d = new Date(viewWeekStart); d.setDate(d.getDate() + dir * 7); setViewWeekStart(toKey(d)); };

  const weekLabel = (() => {
    const s = new Date(weekDays[0]); const e = new Date(weekDays[6]);
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일 — ${e.getMonth() + 1}월 ${e.getDate()}일`;
  })();

  const totalEntries = weekDays.filter((d) => hasContent(entries[d])).length;
  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={S.dateBar}>
        <button style={S.dateArrow} onClick={() => navigateWeek(-1)}>{Icons.chevLeft}</button>
        <div style={S.dateCenter}>
          <span style={S.dateText}>{weekLabel}</span>
          <span style={{ ...S.todayBadge, background: totalEntries > 0 ? C.accentDim : C.bg, color: totalEntries > 0 ? C.accent : C.textDim }}>{totalEntries}/7일 작성</span>
        </div>
        <button style={S.dateArrow} onClick={() => navigateWeek(1)}>{Icons.chevRight}</button>
      </div>

      <div style={S.streakBar}>
        {weekDays.map((d, i) => {
          const has = hasContent(entries[d]);
          const isToday = d === toKey(new Date());
          return (
            <div key={d} style={S.streakDay} onClick={() => goToDate(d)}>
              <span style={{ ...S.streakLabel, color: isToday ? C.accent : C.textDim }}>{dayNames[i]}</span>
              <div style={{ ...S.streakDot, background: has ? C.accent : C.border, boxShadow: has ? `0 0 8px ${C.accentGlow}` : "none", ...(isToday ? { outline: `2px solid ${C.accent}`, outlineOffset: 2 } : {}) }} />
              <span style={{ ...S.streakDate, color: isToday ? C.accent : C.textMid }}>{new Date(d).getDate()}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        {weekDays.map((d, i) => {
          const entry = entries[d];
          const has = hasContent(entry);
          const stats = getEntryStats(entry);
          const isToday = d === toKey(new Date());
          const isWeekend = i >= 5;
          return (
            <div key={d} style={{ ...S.weekCard, ...(has ? {} : { opacity: 0.5 }), ...(isToday ? { borderColor: C.accent } : {}) }} onClick={() => goToDate(d)}>
              <div style={S.weekCardLeft}>
                <span style={{ ...S.weekCardDay, color: isWeekend ? C.down : C.text }}>{dayNames[i]}</span>
                <span style={S.weekCardDate}>{new Date(d).getMonth() + 1}/{new Date(d).getDate()}</span>
                {isToday && <span style={{ ...S.todayBadge, fontSize: 10, padding: "1px 6px" }}>오늘</span>}
              </div>
              <div style={S.weekCardRight}>
                {has && stats ? (
                  <div style={S.weekCardStats}>
                    {stats.marketsWritten > 0 && <span style={S.weekStatPill}>{stats.marketsWritten}지수</span>}
                    {stats.bondsWritten > 0 && <span style={S.weekStatPill}>{stats.bondsWritten}채권</span>}
                    {stats.commoditiesWritten > 0 && <span style={S.weekStatPill}>{stats.commoditiesWritten}원자재</span>}
                    {stats.sectorsWritten > 0 && <span style={S.weekStatPill}>{stats.sectorsWritten}섹터</span>}
                    {stats.stocksWritten > 0 && <span style={S.weekStatPill}>{stats.stocksWritten}종목</span>}
                    {entry?.memo && <span style={{ ...S.weekStatPill, background: C.accentDim, color: C.accent }}>메모</span>}
                  </div>
                ) : (
                  <span style={{ fontSize: 12, color: C.textDim }}>미작성</span>
                )}
              </div>
              <div style={{ color: C.textDim, display: "flex", alignItems: "center" }}>{Icons.chevRight}</div>
            </div>
          );
        })}
      </div>

      <WeeklySummary entries={entries} weekDays={weekDays} />
    </div>
  );
}

function WeeklySummary({ entries, weekDays }) {
  const allMarkets = {};
  const allBonds = {};
  const allCommodities = {};
  weekDays.forEach((d) => {
    const entry = entries[d];
    if (!entry) return;
    entry.markets?.forEach((m) => {
      if (!m.change) return;
      if (!allMarkets[m.id]) allMarkets[m.id] = [];
      allMarkets[m.id].push({ date: d, change: m.change });
    });
    entry.bonds?.forEach((b) => {
      if (!b.change && !b.yield) return;
      if (!allBonds[b.id]) allBonds[b.id] = [];
      allBonds[b.id].push({ date: d, change: b.change, yield: b.yield });
    });
    entry.commodities?.forEach((c) => {
      if (!c.change && !c.price) return;
      if (!allCommodities[c.id]) allCommodities[c.id] = [];
      allCommodities[c.id].push({ date: d, change: c.change, price: c.price });
    });
  });
  const allStocks = {};
  weekDays.forEach((d) => {
    const entry = entries[d];
    if (!entry) return;
    entry.stocks?.forEach((s) => {
      if (!s.name) return;
      if (!allStocks[s.name]) allStocks[s.name] = [];
      allStocks[s.name].push({ date: d, change: s.change, price: s.price });
    });
  });
  const hasData = Object.keys(allMarkets).length > 0 || Object.keys(allStocks).length > 0 || Object.keys(allBonds).length > 0 || Object.keys(allCommodities).length > 0;
  if (!hasData) return null;

  const getIdxLabel = (id) => {
    for (const g of MARKET_INDICES) { for (const idx of g.indices) { if (idx.id === id) return `${g.flag} ${idx.label}`; } }
    for (const d of weekDays) {
      const ci = entries[d]?.customIndices?.find((c) => c.id === id);
      if (ci) { const g = MARKET_INDICES.find((m) => m.country === ci.country); return `${g?.flag || ""} ${ci.label}`; }
    }
    return id;
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, marginBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>주간 요약</span>
        </div>
        {Object.keys(allMarkets).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ ...S.fieldLabel, marginBottom: 8, display: "block" }}>주요 지수 추이</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(allMarkets).map(([id, records]) => (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ minWidth: 90 }}>{getIdxLabel(id)}</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {records.map((m, i) => {
                      const isUp = m.change.includes("+"); const isDown = m.change.includes("-");
                      return <span key={i} style={{ ...S.miniPill, background: isUp ? C.upBg : isDown ? C.downBg : C.bg, color: isUp ? C.up : isDown ? C.down : C.textMid }}>{new Date(m.date).getDate()}일 {m.change}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(allBonds).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ ...S.fieldLabel, marginBottom: 8, display: "block" }}>채권 금리 추이</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {BOND_ITEMS.filter((b) => allBonds[b.id]).map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ minWidth: 80 }}>{b.flag} {b.name}</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {allBonds[b.id].map((r, i) => {
                      const isUp = r.change?.includes("+"); const isDown = r.change?.includes("-");
                      return <span key={i} style={{ ...S.miniPill, background: isUp ? C.upBg : isDown ? C.downBg : C.bg, color: isUp ? C.up : isDown ? C.down : C.textMid }}>{new Date(r.date).getDate()}일 {r.change || r.yield}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(allCommodities).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ ...S.fieldLabel, marginBottom: 8, display: "block" }}>원자재/가상화폐 추이</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {COMMODITY_ITEMS.filter((c) => allCommodities[c.id]).map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ minWidth: 80 }}>{c.name}</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {allCommodities[c.id].map((r, i) => {
                      const isUp = r.change?.includes("+"); const isDown = r.change?.includes("-");
                      return <span key={i} style={{ ...S.miniPill, background: isUp ? C.upBg : isDown ? C.downBg : C.bg, color: isUp ? C.up : isDown ? C.down : C.textMid }}>{new Date(r.date).getDate()}일 {r.change || r.price}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Object.keys(allStocks).length > 0 && (
          <div>
            <span style={{ ...S.fieldLabel, marginBottom: 8, display: "block" }}>주요 종목 추이</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(allStocks).slice(0, 8).map(([name, records]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ minWidth: 80, fontWeight: 600, color: C.text }}>{name}</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {records.map((r, i) => {
                      const isUp = r.change?.includes("+"); const isDown = r.change?.includes("-");
                      return <span key={i} style={{ ...S.miniPill, background: isUp ? C.upBg : isDown ? C.downBg : C.bg, color: isUp ? C.up : isDown ? C.down : C.textMid }}>{new Date(r.date).getDate()}일 {r.change || r.price}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ MONTHLY VIEW ═══ */
function MonthlyView({ entries, viewYear, viewMonth, setViewYear, setViewMonth, goToDate }) {
  const navigateMonth = (dir) => {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last = new Date(viewYear, viewMonth + 1, 0);
    const startDay = first.getDay();
    const adjustedStart = startDay === 0 ? 6 : startDay - 1;
    const days = [];
    for (let i = adjustedStart - 1; i >= 0; i--) { const d = new Date(viewYear, viewMonth, -i); days.push({ date: d, key: toKey(d), inMonth: false }); }
    for (let i = 1; i <= last.getDate(); i++) { const d = new Date(viewYear, viewMonth, i); days.push({ date: d, key: toKey(d), inMonth: true }); }
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) { for (let i = 1; i <= remaining; i++) { const d = new Date(viewYear, viewMonth + 1, i); days.push({ date: d, key: toKey(d), inMonth: false }); } }
    return days;
  }, [viewYear, viewMonth]);

  const monthStats = useMemo(() => {
    let written = 0;
    calendarDays.forEach((d) => { if (d.inMonth && hasContent(entries[d.key])) written++; });
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    return { written, total: daysInMonth, pct: Math.round((written / daysInMonth) * 100) };
  }, [entries, calendarDays, viewYear, viewMonth]);

  const dayHeaders = ["월", "화", "수", "목", "금", "토", "일"];
  const todayKey = toKey(new Date());

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={S.dateBar}>
        <button style={S.dateArrow} onClick={() => navigateMonth(-1)}>{Icons.chevLeft}</button>
        <div style={S.dateCenter}><span style={S.dateText}>{viewYear}년 {viewMonth + 1}월</span></div>
        <button style={S.dateArrow} onClick={() => navigateMonth(1)}>{Icons.chevRight}</button>
      </div>

      <div style={S.monthStatsBar}>
        <div style={S.monthStatItem}><span style={S.monthStatNum}>{monthStats.written}</span><span style={S.monthStatLabel}>작성일</span></div>
        <div style={S.monthStatDivider} />
        <div style={S.monthStatItem}><span style={S.monthStatNum}>{monthStats.total}</span><span style={S.monthStatLabel}>전체일</span></div>
        <div style={S.monthStatDivider} />
        <div style={S.monthStatItem}><span style={{ ...S.monthStatNum, color: monthStats.pct >= 70 ? C.up : monthStats.pct >= 40 ? C.accent : C.down }}>{monthStats.pct}%</span><span style={S.monthStatLabel}>작성률</span></div>
        <div style={{ flex: 1 }} />
        <div style={S.monthProgressOuter}><div style={{ ...S.monthProgressInner, width: `${monthStats.pct}%` }} /></div>
      </div>

      <div style={S.calGrid}>
        {dayHeaders.map((d) => <div key={d} style={S.calHeader}>{d}</div>)}
        {calendarDays.map((d, i) => {
          const has = hasContent(entries[d.key]);
          const isToday = d.key === todayKey;
          const stats = has ? getEntryStats(entries[d.key]) : null;
          const totalItems = stats ? stats.marketsWritten + stats.bondsWritten + stats.commoditiesWritten + stats.sectorsWritten + stats.stocksWritten : 0;
          const intensity = totalItems >= 8 ? 3 : totalItems >= 4 ? 2 : totalItems > 0 ? 1 : 0;
          const isWeekend = i % 7 >= 5;
          return (
            <div key={d.key} style={{ ...S.calCell, opacity: d.inMonth ? 1 : 0.25, ...(isToday ? { outline: `2px solid ${C.accent}`, outlineOffset: -2 } : {}) }} onClick={() => goToDate(d.key)}>
              <span style={{ ...S.calDayNum, color: isToday ? C.accent : isWeekend ? (i % 7 === 6 ? C.down : C.accent) : C.text, fontWeight: isToday ? 700 : 400 }}>{d.date.getDate()}</span>
              {has && <div style={S.calDotRow}><div style={{ ...S.calIntensity, background: C.accent, opacity: 0.3 + intensity * 0.23 }} /></div>}
              {has && entries[d.key]?.memo && <div style={S.calMemoSnip}>{entries[d.key].memo.slice(0, 12)}</div>}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16 }}>
        <span style={{ ...S.fieldLabel, display: "block", marginBottom: 10, fontSize: 12 }}>이번 달 작성된 일지</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {calendarDays.filter((d) => d.inMonth && hasContent(entries[d.key])).length === 0 && (
            <p style={{ fontSize: 13, color: C.textDim, textAlign: "center", padding: 20 }}>이번 달 작성된 일지가 없습니다.</p>
          )}
          {calendarDays.filter((d) => d.inMonth && hasContent(entries[d.key])).map((d) => {
            const stats = getEntryStats(entries[d.key]);
            return (
              <div key={d.key} style={S.weekCard} onClick={() => goToDate(d.key)}>
                <div style={S.weekCardLeft}>
                  <span style={S.weekCardDate}>{d.date.getMonth() + 1}/{d.date.getDate()}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>({["일","월","화","수","목","금","토"][d.date.getDay()]})</span>
                </div>
                <div style={S.weekCardRight}>
                  <div style={S.weekCardStats}>
                    {stats.marketsWritten > 0 && <span style={S.weekStatPill}>{stats.marketsWritten}지수</span>}
                    {stats.bondsWritten > 0 && <span style={S.weekStatPill}>{stats.bondsWritten}채권</span>}
                    {stats.commoditiesWritten > 0 && <span style={S.weekStatPill}>{stats.commoditiesWritten}원자재</span>}
                    {stats.sectorsWritten > 0 && <span style={S.weekStatPill}>{stats.sectorsWritten}섹터</span>}
                    {stats.stocksWritten > 0 && <span style={S.weekStatPill}>{stats.stocksWritten}종목</span>}
                  </div>
                </div>
                <div style={{ color: C.textDim, display: "flex", alignItems: "center" }}>{Icons.chevRight}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ BOND SECTION ═══ */
function BondSection({ entry, updateEntry, autoData }) {
  const upd = (id, f, v) => updateEntry((p) => ({ ...p, bonds: (p.bonds || BOND_ITEMS.map((b) => ({ id: b.id, yield: "", change: "", reason: "" }))).map((b) => b.id === id ? { ...b, [f]: v } : b) }));
  const bonds = entry.bonds || BOND_ITEMS.map((b) => ({ id: b.id, yield: "", change: "", reason: "" }));
  const yd = autoData?.yahoo_data || {};
  const autoFillBonds = () => {
    updateEntry((p) => ({
      ...p,
      bonds: (p.bonds || BOND_ITEMS.map((b) => ({ id: b.id, yield: "", change: "", reason: "" }))).map((b) => {
        const d = yd[b.id];
        if (!d) return b;
        return { ...b, yield: b.yield || d.price, change: b.change || d.change || "" };
      }),
    }));
  };
  return (
    <div style={S.sectionWrap}>
      {Object.keys(yd).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12,  }}>
          <button style={{ ...S.scrapAddBtn, background: "#16A34A", marginBottom: 6 }} onClick={autoFillBonds}>
            {Icons.activity} 채권 금리 자동 입력 (빈 칸만 채움)
          </button>
          <p style={{ fontSize: 9, color: C.textDim, margin: 0, textAlign: "center" }}>{autoData?.date_key || ""} 기준 | 실제 시세와 차이가 있을 수 있습니다</p>
        </div>
      )}
      {BOND_ITEMS.map((item) => {
        const b = bonds.find((x) => x.id === item.id) || {};
        return (
          <div key={item.id} style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.flag}>{item.flag}</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.cardTitle, color: C.accent, textDecoration: "none" }}>{item.name}</a>
              {b.change && <span style={{ ...S.changeBadge, ...(b.change.includes("-") ? S.changeDown : b.change.includes("+") ? S.changeUp : {}) }}>{b.change}</span>}
            </div>
            <div style={S.cardGrid}>
              <div style={S.fieldGroup}><label style={S.fieldLabel}>금리 (수익률)</label><input style={S.inputSmall} placeholder="예: 4.25%" value={b.yield || ""} onChange={(e) => upd(item.id, "yield", e.target.value)} /></div>
              <div style={S.fieldGroup}><label style={S.fieldLabel}>등락</label><input style={S.inputSmall} placeholder="예: +0.05%p" value={b.change || ""} onChange={(e) => upd(item.id, "change", e.target.value)} /></div>
            </div>
            <div style={S.fieldGroup}><label style={S.fieldLabel}>변동 이유 / 특이사항</label><textarea style={S.textarea} rows={2} placeholder="금리 변동 요인..." value={b.reason || ""} onChange={(e) => upd(item.id, "reason", e.target.value)} /></div>
          </div>
        );
      })}
      <div style={S.card}>
        <div style={S.fieldGroup}><label style={{ ...S.fieldLabel, fontSize: 12 }}>채권 시장 전망</label><textarea style={S.textarea} rows={3} placeholder="채권 시장 전반적인 전망, 금리 방향성..." value={entry.bondOutlook || ""} onChange={(e) => updateEntry((p) => ({ ...p, bondOutlook: e.target.value }))} /></div>
      </div>
    </div>
  );
}

/* ═══ COMMODITY SECTION ═══ */
function CommoditySection({ entry, updateEntry, autoData }) {
  const upd = (id, f, v) => updateEntry((p) => ({ ...p, commodities: (p.commodities || COMMODITY_ITEMS.map((c) => ({ id: c.id, price: "", change: "", reason: "" }))).map((c) => c.id === id ? { ...c, [f]: v } : c) }));
  const commodities = entry.commodities || COMMODITY_ITEMS.map((c) => ({ id: c.id, price: "", change: "", reason: "" }));
  const yd = autoData?.yahoo_data || {};
  const autoFillCommodities = () => {
    updateEntry((p) => ({
      ...p,
      commodities: (p.commodities || COMMODITY_ITEMS.map((c) => ({ id: c.id, price: "", change: "", reason: "" }))).map((c) => {
        const d = yd[c.id];
        if (!d) return c;
        return { ...c, price: c.price || d.price, change: c.change || d.change || "" };
      }),
    }));
  };

  const grouped = {};
  COMMODITY_ITEMS.forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  return (
    <div style={S.sectionWrap}>
      {Object.keys(yd).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12,  }}>
          <button style={{ ...S.scrapAddBtn, background: "#16A34A", marginBottom: 6 }} onClick={autoFillCommodities}>
            {Icons.activity} 원자재/가상화폐 자동 입력 (빈 칸만 채움)
          </button>
          <p style={{ fontSize: 9, color: C.textDim, margin: 0, textAlign: "center" }}>{autoData?.date_key || ""} 기준 | 실제 시세와 차이가 있을 수 있습니다</p>
        </div>
      )}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 0 6px", marginTop: 4 }}>{category}</div>
          {items.map((item) => {
            const c = commodities.find((x) => x.id === item.id) || {};
            return (
              <div key={item.id} style={{ ...S.card, marginBottom: 8 }}>
                <div style={S.cardHeader}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.cardTitle, color: C.accent, textDecoration: "none" }}>{item.name}</a>
                  {c.change && <span style={{ ...S.changeBadge, ...(c.change.includes("-") ? S.changeDown : c.change.includes("+") ? S.changeUp : {}) }}>{c.change}</span>}
                </div>
                <div style={S.cardGrid}>
                  <div style={S.fieldGroup}><label style={S.fieldLabel}>가격</label><input style={S.inputSmall} placeholder="예: 2,340.50" value={c.price || ""} onChange={(e) => upd(item.id, "price", e.target.value)} /></div>
                  <div style={S.fieldGroup}><label style={S.fieldLabel}>등락</label><input style={S.inputSmall} placeholder="예: +1.8%" value={c.change || ""} onChange={(e) => upd(item.id, "change", e.target.value)} /></div>
                </div>
                <div style={S.fieldGroup}><label style={S.fieldLabel}>변동 이유</label><textarea style={S.textarea} rows={2} placeholder="가격 변동 요인..." value={c.reason || ""} onChange={(e) => upd(item.id, "reason", e.target.value)} /></div>
              </div>
            );
          })}
        </div>
      ))}
      <div style={S.card}>
        <div style={S.fieldGroup}><label style={{ ...S.fieldLabel, fontSize: 12 }}>원자재/가상화폐 전망</label><textarea style={S.textarea} rows={3} placeholder="원자재·가상화폐 시장 전반적인 전망..." value={entry.commodityOutlook || ""} onChange={(e) => updateEntry((p) => ({ ...p, commodityOutlook: e.target.value }))} /></div>
      </div>
    </div>
  );
}

/* ═══ MARKET ═══ */
function MarketSection({ entry, updateEntry, autoData }) {
  const [addingCustom, setAddingCustom] = useState(null);
  const [customName, setCustomName] = useState("");

  const markets = entry.markets || [];
  const customs = entry.customIndices || [];
  const notes = entry.marketNotes || {};
  const yahooData = autoData?.yahoo_data || {};

  const updIdx = (id, f, v) => updateEntry((p) => ({
    ...p,
    markets: (p.markets || []).map((m) => m.id === id ? { ...m, [f]: v } : m),
  }));
  const updNote = (country, f, v) => updateEntry((p) => ({
    ...p,
    marketNotes: { ...(p.marketNotes || {}), [country]: { ...(p.marketNotes?.[country] || {}), [f]: v } },
  }));

  const autoFillAll = () => {
    if (!yahooData || Object.keys(yahooData).length === 0) return;
    updateEntry((p) => ({
      ...p,
      markets: (p.markets || []).map((m) => {
        const yd = yahooData[m.id];
        if (!yd) return m;
        return { ...m, value: m.value || yd.price, change: m.change || yd.change || "" };
      }),
    }));
  };

  const addIndex = (country, id, label) => {
    updateEntry((p) => ({
      ...p,
      markets: [...(p.markets || []), { id, country, value: "", change: "" }],
    }));
  };
  const removeIndex = (id) => {
    updateEntry((p) => ({
      ...p,
      markets: (p.markets || []).filter((m) => m.id !== id),
      customIndices: (p.customIndices || []).filter((c) => c.id !== id),
    }));
  };
  const addCustomIndex = (country) => {
    if (!customName.trim()) return;
    const id = "custom_" + Date.now();
    updateEntry((p) => ({
      ...p,
      markets: [...(p.markets || []), { id, country, value: "", change: "" }],
      customIndices: [...(p.customIndices || []), { id, country, label: customName.trim() }],
    }));
    setCustomName("");
    setAddingCustom(null);
  };

  const activeIds = new Set(markets.map((m) => m.id));

  return (
    <div style={S.sectionWrap}>
      {Object.keys(yahooData).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12,  }}>
          <button style={{ ...S.scrapAddBtn, background: "#16A34A", marginBottom: 6 }} onClick={autoFillAll}>
            {Icons.activity} 지수 자동 입력 (빈 칸만 채움)
          </button>
          <p style={{ fontSize: 9, color: C.textDim, margin: 0, textAlign: "center", lineHeight: 1.4 }}>
            {autoData?.date_key || ""} 기준 수집 데이터 | 매일 오전 6:30·오후 4:00 자동 갱신 | 실제 시세와 차이가 있을 수 있습니다
          </p>
        </div>
      )}
      {MARKET_INDICES.map((group) => {
        const countryNote = notes[group.country] || {};
        const activeIndices = group.indices.filter((idx) => activeIds.has(idx.id));
        const inactiveIndices = group.indices.filter((idx) => !activeIds.has(idx.id));
        const countryCustoms = customs.filter((c) => c.country === group.country && activeIds.has(c.id));

        return (
          <div key={group.country} style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.flag}>{group.flag}</span>
              <span style={S.cardTitle}>{group.name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activeIndices.map((idx) => {
                const m = markets.find((x) => x.id === idx.id) || {};
                return (
                  <div key={idx.id} style={S.indexRow}>
                    {idx.url ? <a href={idx.url} target="_blank" rel="noopener noreferrer" style={{ ...S.indexLabel, color: C.accent, textDecoration: "none", cursor: "pointer" }}>{idx.label}</a> : <span style={S.indexLabel}>{idx.label}</span>}
                    <input style={S.indexInput} placeholder="지수" value={m.value || ""} onChange={(e) => updIdx(idx.id, "value", e.target.value)} />
                    <input style={{ ...S.indexInput, maxWidth: 90 }} placeholder="등락" value={m.change || ""} onChange={(e) => updIdx(idx.id, "change", e.target.value)} />
                    {m.change && <span style={{ ...S.changeBadgeSm, ...(m.change.includes("-") ? { color: C.down, background: C.downBg } : m.change.includes("+") ? { color: C.up, background: C.upBg } : {}) }}>{m.change}</span>}
                    <button style={S.indexRemoveBtn} onClick={() => removeIndex(idx.id)} title="지수 숨기기">{Icons.x}</button>
                  </div>
                );
              })}
              {countryCustoms.map((ci) => {
                const m = markets.find((x) => x.id === ci.id) || {};
                return (
                  <div key={ci.id} style={S.indexRow}>
                    <span style={S.indexLabel}>{ci.label}</span>
                    <input style={S.indexInput} placeholder="지수" value={m.value || ""} onChange={(e) => updIdx(ci.id, "value", e.target.value)} />
                    <input style={{ ...S.indexInput, maxWidth: 90 }} placeholder="등락" value={m.change || ""} onChange={(e) => updIdx(ci.id, "change", e.target.value)} />
                    {m.change && <span style={{ ...S.changeBadgeSm, ...(m.change.includes("-") ? { color: C.down, background: C.downBg } : m.change.includes("+") ? { color: C.up, background: C.upBg } : {}) }}>{m.change}</span>}
                    <button style={S.indexRemoveBtn} onClick={() => removeIndex(ci.id)} title="지수 삭제">{Icons.x}</button>
                  </div>
                );
              })}
            </div>
            {/* Add index chips */}
            {(inactiveIndices.length > 0 || true) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {inactiveIndices.map((idx) => (
                  <button key={idx.id} style={S.addChip} onClick={() => addIndex(group.country, idx.id, idx.label)}>+ {idx.label}</button>
                ))}
                {addingCustom === group.country ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input style={{ ...S.indexInput, maxWidth: 120, fontSize: 11, padding: "4px 8px" }} placeholder="지수명 입력" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomIndex(group.country)} autoFocus />
                    <button style={{ ...S.addChip, background: C.accent, color: "#fff", borderColor: C.accent }} onClick={() => addCustomIndex(group.country)}>추가</button>
                    <button style={S.addChip} onClick={() => { setAddingCustom(null); setCustomName(""); }}>취소</button>
                  </div>
                ) : (
                  <button style={{ ...S.addChip, borderStyle: "dashed" }} onClick={() => setAddingCustom(group.country)}>+ 직접 입력</button>
                )}
              </div>
            )}
            <div style={S.fieldGroup}><label style={S.fieldLabel}>변동 이유</label><textarea style={S.textarea} rows={2} placeholder={`${group.name} 증시 변동 요인...`} value={countryNote.reason || ""} onChange={(e) => updNote(group.country, "reason", e.target.value)} /></div>
            <div style={S.fieldGroup}><label style={S.fieldLabel}>전망</label><textarea style={S.textarea} rows={2} placeholder={`${group.name} 증시 향후 전망...`} value={countryNote.outlook || ""} onChange={(e) => updNote(group.country, "outlook", e.target.value)} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ SECTOR ═══ */
function SectorSection({ entry, updateEntry }) {
  const add = () => updateEntry((p) => ({ ...p, sectors: [...p.sectors, { id: Date.now(), name: "", change: "", reason: "", outlook: "" }] }));
  const rm = (id) => updateEntry((p) => ({ ...p, sectors: p.sectors.filter((s) => s.id !== id) }));
  const upd = (id, f, v) => updateEntry((p) => ({ ...p, sectors: p.sectors.map((s) => s.id === id ? { ...s, [f]: v } : s) }));
  return (
    <div style={S.sectionWrap}>
      {entry.sectors.map((s, i) => (
        <div key={s.id} style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.sectionNum}>#{i + 1}</span>
            <input style={S.cardTitleInput} placeholder="섹터명 (예: 반도체, 2차전지...)" value={s.name} onChange={(e) => upd(s.id, "name", e.target.value)} />
            {entry.sectors.length > 1 && <button style={S.removeBtn} onClick={() => rm(s.id)}>{Icons.trash}</button>}
          </div>
          <div style={S.fieldGroup}><label style={S.fieldLabel}>주가 변화</label><input style={S.input} placeholder="예: 반도체 ETF +2.3%" value={s.change} onChange={(e) => upd(s.id, "change", e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.fieldLabel}>변동 이유</label><textarea style={S.textarea} rows={2} placeholder="섹터 변동 원인..." value={s.reason} onChange={(e) => upd(s.id, "reason", e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.fieldLabel}>전망</label><textarea style={S.textarea} rows={2} placeholder="향후 전망..." value={s.outlook} onChange={(e) => upd(s.id, "outlook", e.target.value)} /></div>
        </div>
      ))}
      <button style={S.addBtn} onClick={add}>{Icons.plus} 섹터 추가</button>
    </div>
  );
}

/* ═══ STOCK ═══ */
function StockSection({ entry, updateEntry, autoData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchingId, setSearchingId] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(null);

  const add = () => updateEntry((p) => ({ ...p, stocks: [...p.stocks, { id: Date.now(), name: "", ticker: "", price: "", change: "", reason: "", outlook: "" }] }));
  const rm = (id) => updateEntry((p) => ({ ...p, stocks: p.stocks.filter((s) => s.id !== id) }));
  const upd = (id, f, v) => updateEntry((p) => ({ ...p, stocks: p.stocks.map((s) => s.id === id ? { ...s, [f]: v } : s) }));

  const searchTimerRef = useRef(null);
  const searchStock = async (query, stockId) => {
    if (!query || query.length < 1) { setSearchResults([]); return; }
    setSearchingId(stockId);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/yahoo-proxy?search=${encodeURIComponent(query)}`);
        if (!res.ok) { setSearchResults([]); return; }
        const data = await res.json();
        const quotes = (data.quotes || []).filter(q => q.symbol).slice(0, 8);
        setSearchResults(quotes);
      } catch (e) { setSearchResults([]); }
    }, 300);
  };

  const selectStock = async (stockId, result) => {
    const displayName = result.shortname || result.longname || result.symbol;
    upd(stockId, "name", displayName);
    upd(stockId, "ticker", result.symbol);
    setSearchResults([]);
    setSearchingId(null);
    setSearchQuery("");
    setLoadingPrice(stockId);
    try {
      const res = await fetch(`/api/yahoo-proxy?symbols=${encodeURIComponent(result.symbol)}`);
      if (res.ok) {
        const data = await res.json();
        const d = data[result.symbol];
        if (d) {
          updateEntry((p) => ({ ...p, stocks: p.stocks.map((s) => s.id === stockId ? { ...s, price: d.price, change: d.change || "" } : s) }));
        }
      }
    } catch (e) {}
    setLoadingPrice(null);
  };

  const refreshPrice = async (stockId, ticker) => {
    if (!ticker) return;
    setLoadingPrice(stockId);
    try {
      const res = await fetch(`/api/yahoo-proxy?symbols=${encodeURIComponent(ticker)}`);
      if (res.ok) {
        const data = await res.json();
        const d = data[ticker];
        if (d) {
          updateEntry((p) => ({ ...p, stocks: p.stocks.map((s) => s.id === stockId ? { ...s, price: d.price, change: d.change || "" } : s) }));
        }
      }
    } catch (e) {}
    setLoadingPrice(null);
  };

  return (
    <div style={S.sectionWrap}>
      {entry.stocks.map((s, i) => (
        <div key={s.id} style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.sectionNum}>#{i + 1}</span>
            <div style={{ flex: 1, position: "relative" }}>
              <input style={S.cardTitleInput} placeholder="종목 검색 (영문 권장: NVIDIA, Samsung...)" value={searchingId === s.id ? searchQuery : s.name}
                onFocus={() => { setSearchingId(s.id); setSearchQuery(s.name); }}
                onChange={(e) => { setSearchQuery(e.target.value); upd(s.id, "name", e.target.value); searchStock(e.target.value, s.id); }} />
              {searchingId === s.id && searchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: 200, overflow: "auto" }}>
                  {searchResults.map((r) => (
                    <div key={r.symbol} onClick={() => selectStock(s.id, r)} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                      <span><span style={{ fontWeight: 600 }}>{r.shortname || r.longname || r.symbol}</span></span>
                      <span style={{ color: C.textDim, fontFamily: C.mono, fontSize: 11 }}>{r.symbol} · {r.exchDisp || r.exchange || ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {s.ticker && <span style={{ fontSize: 9, color: C.accent, fontFamily: C.mono, fontWeight: 600, flexShrink: 0 }}>{s.ticker}</span>}
            {entry.stocks.length > 1 && <button style={S.removeBtn} onClick={() => rm(s.id)}>{Icons.trash}</button>}
          </div>
          <div style={S.cardGrid}>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>현재가 {s.ticker && <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 9, fontFamily: C.sans }} onClick={() => refreshPrice(s.id, s.ticker)}>{loadingPrice === s.id ? "..." : "새로고침"}</button>}</label>
              <input style={S.inputSmall} placeholder="예: 72,500" value={s.price} onChange={(e) => upd(s.id, "price", e.target.value)} />
            </div>
            <div style={S.fieldGroup}><label style={S.fieldLabel}>등락</label><input style={S.inputSmall} placeholder="예: +3.2%" value={s.change} onChange={(e) => upd(s.id, "change", e.target.value)} /></div>
          </div>
          <div style={S.fieldGroup}><label style={S.fieldLabel}>변동 이유</label><textarea style={S.textarea} rows={2} placeholder="변동 원인..." value={s.reason} onChange={(e) => upd(s.id, "reason", e.target.value)} /></div>
          <div style={S.fieldGroup}><label style={S.fieldLabel}>전망</label><textarea style={S.textarea} rows={2} placeholder="향후 전망..." value={s.outlook} onChange={(e) => upd(s.id, "outlook", e.target.value)} /></div>
        </div>
      ))}
      <button style={S.addBtn} onClick={add}>{Icons.plus} 종목 추가</button>
    </div>
  );
}

/* ═══ FX SECTION ═══ */
function FxSection({ entry, updateEntry, autoData }) {
  const upd = (id, f, v) => updateEntry((p) => ({ ...p, fx: (p.fx || FX_ITEMS.map((f) => ({ id: f.id, rate: "", change: "" }))).map((x) => x.id === id ? { ...x, [f]: v } : x) }));
  const fxData = entry.fx || FX_ITEMS.map((f) => ({ id: f.id, rate: "", change: "" }));
  const yd = autoData?.yahoo_data || {};
  const autoFillFx = () => {
    updateEntry((p) => ({
      ...p,
      fx: (p.fx || FX_ITEMS.map((f) => ({ id: f.id, rate: "", change: "" }))).map((x) => {
        const d = yd[x.id];
        if (!d) return x;
        return { ...x, rate: x.rate || d.price, change: x.change || d.change || "" };
      }),
    }));
  };
  return (
    <div style={S.sectionWrap}>
      {Object.keys(yd).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12,  }}>
          <button style={{ ...S.scrapAddBtn, background: "#16A34A", marginBottom: 6 }} onClick={autoFillFx}>
            {Icons.activity} 환율 자동 입력 (빈 칸만 채움)
          </button>
          <p style={{ fontSize: 9, color: C.textDim, margin: 0, textAlign: "center" }}>{autoData?.date_key || ""} 기준 | 실제 시세와 차이가 있을 수 있습니다</p>
        </div>
      )}
      {FX_ITEMS.map((item) => {
        const f = fxData.find((x) => x.id === item.id) || {};
        return (
          <div key={item.id} style={S.card}>
            <div style={S.cardHeader}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.cardTitle, color: C.accent, textDecoration: "none" }}>{item.name}</a>
              {f.change && <span style={{ ...S.changeBadge, ...(f.change.includes("-") ? S.changeDown : f.change.includes("+") ? S.changeUp : {}) }}>{f.change}</span>}
            </div>
            <div style={S.cardGrid}>
              <div style={S.fieldGroup}><label style={S.fieldLabel}>환율</label><input style={S.inputSmall} placeholder="예: 1,380.50" value={f.rate || ""} onChange={(e) => upd(item.id, "rate", e.target.value)} /></div>
              <div style={S.fieldGroup}><label style={S.fieldLabel}>등락</label><input style={S.inputSmall} placeholder="예: +0.5%" value={f.change || ""} onChange={(e) => upd(item.id, "change", e.target.value)} /></div>
            </div>
          </div>
        );
      })}
      <div style={S.card}>
        <div style={S.fieldGroup}><label style={{ ...S.fieldLabel, fontSize: 12 }}>환율 전망</label><textarea style={S.textarea} rows={3} placeholder="환율 전망, 달러 강세/약세 요인..." value={entry.fxOutlook || ""} onChange={(e) => updateEntry((p) => ({ ...p, fxOutlook: e.target.value }))} /></div>
      </div>
    </div>
  );
}

/* ═══ TOP10 PAGE (거래대금 TOP 10) ═══ */
const TOP10_MARKETS = [
  { id: "us", label: "미국", flag: "\uD83C\uDDFA\uD83C\uDDF8", symbols: ["AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","BRK-B","JPM"], exchange: "NASDAQ/NYSE" },
  { id: "kr", label: "한국", flag: "\uD83C\uDDF0\uD83C\uDDF7", symbols: ["005930.KS","000660.KS","373220.KS","005380.KS","035420.KS","068270.KS","035720.KS","051910.KS","006400.KS","003670.KS"], exchange: "코스피/코스닥" },
  { id: "jp", label: "일본", flag: "\uD83C\uDDEF\uD83C\uDDF5", symbols: ["7203.T","6758.T","8306.T","9984.T","6861.T","6501.T","7267.T","4502.T","8035.T","6902.T"], exchange: "도쿄" },
  { id: "cn", label: "중국", flag: "\uD83C\uDDE8\uD83C\uDDF3", symbols: ["600519.SS","601398.SS","600036.SS","000858.SZ","601288.SS","600276.SS","601318.SS","000333.SZ","601857.SS","600900.SS"], exchange: "상해/심천" },
];

function Top10Page({ autoData, showToast }) {
  const [activeMarket, setActiveMarket] = useState("us");
  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchMarketTop10 = async (marketId) => {
    const market = TOP10_MARKETS.find((m) => m.id === marketId);
    if (!market) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/yahoo-proxy?symbols=${market.symbols.join(",")}`);
      if (!res.ok) { setLoading(false); showToast("데이터를 가져올 수 없습니다"); return; }
      const data = await res.json();
      const results = Object.entries(data).map(([symbol, d]) => ({ symbol, ...d }));
      results.sort((a, b) => (b.tradingValue || 0) - (a.tradingValue || 0));
      setStockData((prev) => ({ ...prev, [marketId]: results.slice(0, 10) }));
      setLastFetched(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) { showToast("네트워크 오류"); }
    setLoading(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    for (const m of TOP10_MARKETS) { await fetchMarketTop10(m.id); }
    setLoading(false);
    showToast("전체 시장 데이터 가져옴");
  };

  const formatVal = (v) => {
    if (!v) return "—";
    if (v >= 1e12) return `${(v/1e12).toFixed(1)}조`;
    if (v >= 1e8) return `${(v/1e8).toFixed(0)}억`;
    if (v >= 1e6) return `${(v/1e6).toFixed(0)}M`;
    if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const currentMarket = TOP10_MARKETS.find((m) => m.id === activeMarket);
  const currentData = stockData[activeMarket] || [];

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button style={{ ...S.scrapAddBtn, width: "auto", padding: "8px 16px", flex: "none" }} onClick={fetchAll} disabled={loading}>
          {loading ? "가져오는 중..." : "전체 시장 데이터 가져오기"}
        </button>
        {lastFetched && <span style={{ fontSize: 10, color: C.textDim }}>{lastFetched} 기준</span>}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
        {TOP10_MARKETS.map((m) => (
          <button key={m.id} style={{ ...S.catBtn, ...(activeMarket === m.id ? S.catBtnActive : {}), fontSize: 12, padding: "7px 14px" }} onClick={() => { setActiveMarket(m.id); if (!stockData[m.id]) fetchMarketTop10(m.id); }}>
            {m.flag} {m.label}
          </button>
        ))}
      </div>

      {loading && !currentData.length && (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim }}>
          <div style={{ ...S.loadSpin, margin: "0 auto 12px" }} />
          <p style={{ fontSize: 12 }}>데이터를 가져오는 중...</p>
        </div>
      )}

      {!loading && currentData.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim }}>
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>아직 데이터가 없습니다</p>
          <button style={{ ...S.addChip, padding: "6px 16px", fontSize: 12 }} onClick={() => fetchMarketTop10(activeMarket)}>
            {currentMarket?.flag} {currentMarket?.label} 데이터 가져오기
          </button>
        </div>
      )}

      {currentData.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 600, color: C.textDim }}>
            <span style={{ width: 28 }}>#</span>
            <span style={{ flex: 1 }}>종목</span>
            <span style={{ width: 80, textAlign: "right" }}>현재가</span>
            <span style={{ width: 60, textAlign: "right" }}>등락</span>
            <span style={{ width: 70, textAlign: "right" }}>거래대금</span>
          </div>
          {currentData.map((s, i) => {
            const isUp = s.change?.includes("+");
            const isDown = s.change?.includes("-");
            return (
              <a key={s.symbol} href={`https://finance.yahoo.com/quote/${encodeURIComponent(s.symbol)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", padding: "9px 12px", borderBottom: i < currentData.length - 1 ? `1px solid ${C.border}` : "none", fontSize: 11, textDecoration: "none", color: "inherit", cursor: "pointer" }}>
                <span style={{ width: 28, fontWeight: 700, color: i < 3 ? C.accent : C.textDim, fontFamily: C.mono }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 9, color: C.textDim, fontFamily: C.mono }}>{s.symbol}</div>
                </div>
                <span style={{ width: 80, textAlign: "right", fontWeight: 600, fontFamily: C.mono, color: C.text }}>{Number(s.price) > 999 ? Number(s.price).toLocaleString("en", {maximumFractionDigits: 0}) : s.price}</span>
                <span style={{ width: 60, textAlign: "right", fontWeight: 600, fontFamily: C.mono, color: isUp ? C.up : isDown ? C.down : C.textDim }}>{s.change || "—"}</span>
                <span style={{ width: 70, textAlign: "right", fontFamily: C.mono, color: C.textMid, fontSize: 10 }}>{formatVal(s.tradingValue)}</span>
              </a>
            );
          })}
          <a href="https://finance.yahoo.com/markets/stocks/most-active/" target="_blank" rel="noopener noreferrer"
            style={{ display: "block", textAlign: "center", padding: "10px 0", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.accent, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
            더보기 →
          </a>
        </div>
      )}

      <p style={{ fontSize: 8, color: C.textDim, margin: "6px 0 0", textAlign: "center" }}>
        Yahoo Finance 기준 | 실시간 데이터가 아니며 15분 지연될 수 있습니다 | 거래대금 = 현재가 × 거래량
      </p>
    </div>
  );
}

/* ═══ DASHBOARD PAGE ═══ */
const DEFAULT_LINKS = [
  { id: "econ", label: "경제 캘린더", url: "https://kr.investing.com/economic-calendar" },
  { id: "earn", label: "기업 실적", url: "https://kr.investing.com/earnings-calendar" },
  { id: "stock", label: "증시 확인", url: "https://stock.naver.com/" },
  { id: "hk", label: "한국경제", url: "https://www.hankyung.com/" },
  { id: "bell", label: "더벨", url: "https://www.thebell.co.kr/front/index.asp" },
];

function DashboardPage({ setPage, entries, scraps, reports, indicators, routineLinks, setRoutineLinks, saveAll, autoData, setAutoData }) {
  const [showLinkEditor, setShowLinkEditor] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [showCalDetail, setShowCalDetail] = useState(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualBonds, setManualBonds] = useState(() => {
    try { const s = localStorage.getItem("manualBonds"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [editingBondId, setEditingBondId] = useState(null);
  const [bondInput, setBondInput] = useState("");

  const saveManualBond = (id, val) => {
    const updated = { ...manualBonds, [id]: val };
    setManualBonds(updated);
    localStorage.setItem("manualBonds", JSON.stringify(updated));
    setEditingBondId(null);
    setBondInput("");
  };

  const refreshMarketData = async () => {
    setRefreshing(true);
    try {
      if (window.getLatestAutoData) {
        const ad = await window.getLatestAutoData();
        if (ad) setAutoData(ad);
      }
    } catch (e) {}
    setRefreshing(false);
  };

  const links = routineLinks.length > 0 ? routineLinks : DEFAULT_LINKS;

  const addLink = () => {
    if (!newLabel.trim() || !newUrl.trim()) return;
    const updated = [...links, { id: "l_" + Date.now(), label: newLabel.trim(), url: newUrl.trim() }];
    setRoutineLinks(updated);
    setNewLabel(""); setNewUrl("");
  };
  const removeLink = (id) => { setRoutineLinks(links.filter((l) => l.id !== id)); };
  const moveLink = (i, dir) => {
    const arr = [...links];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setRoutineLinks(arr);
  };

  const today = new Date();
  const todayKey = toKey(today);
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const hours = today.getHours();
  const greeting = hours < 6 ? "새벽 작업 중이시군요" : hours < 12 ? "좋은 아침이에요" : hours < 18 ? "좋은 오후예요" : "좋은 저녁이에요";

  const journalCount = Object.keys(entries).filter((k) => hasContent(entries[k])).length;
  const todayWritten = hasContent(entries[todayKey]);
  const indCount = Object.keys(indicators).filter((k) => !k.startsWith("_") && indicators[k]?.length > 0).length;

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date(today);
    for (let i = 0; i < 365; i++) {
      const key = toKey(d);
      if (hasContent(entries[key])) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); }
      else break;
    }
    return count;
  }, [entries]);

  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ key: toKey(d), day: ["일","월","화","수","목","금","토"][d.getDay()], has: hasContent(entries[toKey(d)]) });
    }
    return days;
  }, [entries]);

  const H = {
    hero: { background: "#1A1D23", borderRadius: 8, padding: "24px 22px", marginTop: 12, marginBottom: 14, position: "relative", overflow: "hidden" },
    heroAccent: { position: "absolute", width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)", top: -40, right: -20 },
    heroGreeting: { fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "0 0 2px", fontWeight: 400, position: "relative", zIndex: 1 },
    heroDate: { fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 16px", letterSpacing: -0.8, lineHeight: 1.2, position: "relative", zIndex: 1 },
    heroStats: { display: "flex", gap: 6, position: "relative", zIndex: 1, flexWrap: "wrap" },
    heroStat: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 54, padding: "7px 10px", borderRadius: 5, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)" },
    heroStatNum: { fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: C.mono, lineHeight: 1 },
    heroStatLabel: { fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3, fontWeight: 500 },
    streakBox: { display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, marginBottom: 12 },
    streakLeft: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 50 },
    streakNum: { fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: C.mono, lineHeight: 1 },
    streakLbl: { fontSize: 9, color: C.textDim, marginTop: 2, fontWeight: 600 },
    dots: { display: "flex", gap: 5, flex: 1, justifyContent: "center", flexWrap: "wrap" },
    dot: (has) => ({ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, background: has ? C.accent : C.bg, color: has ? "#fff" : C.textDim, border: has ? "none" : `1px solid ${C.border}` }),
    dotLabel: { fontSize: 9, color: C.textDim, marginTop: 2, textAlign: "center" },
    section: { fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 8px" },
    nav: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 },
    navCard: (c) => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, cursor: "pointer", borderLeft: `3px solid ${c}` }),
    navIcon: (c) => ({ width: 34, height: 34, borderRadius: 5, background: c + "0D", color: c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    navTitle: { fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: -0.2 },
    navDesc: { fontSize: 10, color: C.textDim },
    linkRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 5, textDecoration: "none", marginBottom: 5 },
    linkNum: { width: 22, height: 22, borderRadius: 4, background: C.accentDim, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  };

  return (
    <div style={{ padding: "0 0 16px" }}>
      <div style={H.hero}>
        <div style={H.heroAccent} />
        <p style={H.heroGreeting}>{greeting}</p>
        <p style={H.heroDate}>{today.getMonth() + 1}월 {today.getDate()}일 {weekdays[today.getDay()]}</p>
        <div style={H.heroStats}>
          <div style={H.heroStat}><span style={H.heroStatNum}>{journalCount}</span><span style={H.heroStatLabel}>일지</span></div>
          <div style={H.heroStat}><span style={H.heroStatNum}>{scraps.length}</span><span style={H.heroStatLabel}>스크랩</span></div>
          <div style={H.heroStat}><span style={H.heroStatNum}>{reports.length}</span><span style={H.heroStatLabel}>레포트</span></div>
          <div style={H.heroStat}><span style={H.heroStatNum}>{indCount}</span><span style={H.heroStatLabel}>지표</span></div>
        </div>
      </div>

      <div style={H.streakBox}>
        <div style={H.streakLeft}>
          <span style={H.streakNum}>{streak}</span>
          <span style={H.streakLbl}>연속</span>
        </div>
        <div style={{ width: 1, height: 30, background: C.border }} />
        <div style={H.dots}>
          {last7.map((d) => (
            <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={H.dot(d.has)}>{d.has ? "\u2713" : ""}</div>
              <span style={H.dotLabel}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {!todayWritten && (
        <div onClick={() => setPage("journal")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: C.accentDim, border: `1px solid ${C.accent}20`, borderRadius: 8, marginBottom: 14, cursor: "pointer" }}>
          <span style={{ color: C.accent }}>{Icons.edit}</span>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, display: "block" }}>오늘 일지를 아직 안 쓰셨어요</span>
            <span style={{ fontSize: 10, color: C.textDim }}>탭해서 작성하세요</span>
          </div>
        </div>
      )}

      {/* Auto market snapshot */}
      {(() => {
        const hasData = autoData?.yahoo_data && Object.keys(autoData.yahoo_data).length > 0;
        const yd = autoData?.yahoo_data || {};
        const marketGroups = [
          { label: "증시", color: "#2563EB", items: [
            { id: "sp500", label: "S&P 500", url: "https://kr.investing.com/indices/us-spx-500" },
            { id: "nasdaq", label: "나스닥", url: "https://kr.investing.com/indices/nasdaq-composite" },
            { id: "dow", label: "다우", url: "https://kr.investing.com/indices/us-30" },
            { id: "kospi", label: "코스피", url: "https://kr.investing.com/indices/kospi" },
            { id: "kosdaq", label: "코스닥", url: "https://kr.investing.com/indices/kosdaq" },
            { id: "nikkei", label: "닛케이", url: "https://kr.investing.com/indices/japan-ni225" },
            { id: "shanghai", label: "상해", url: "https://kr.investing.com/indices/shanghai-composite" },
          ]},
          { label: "채권", color: "#6554C0", items: [
            { id: "us10y", label: "미국10Y", url: "https://kr.investing.com/rates-bonds/u.s.-10-year-bond-yield" },
            { id: "us2y", label: "미국2Y", url: "https://kr.investing.com/rates-bonds/u.s.-2-year-bond-yield" },
            { id: "kr10y", label: "한국10Y", url: "https://kr.investing.com/rates-bonds/south-korea-10-year-bond-yield" },
            { id: "kr3y", label: "한국3Y", url: "https://kr.investing.com/rates-bonds/south-korea-3-year-bond-yield" },
          ]},
          { label: "원자재·가상화폐", color: "#FF5630", items: [
            { id: "gold", label: "금", url: "https://kr.investing.com/commodities/gold" },
            { id: "oil", label: "WTI", url: "https://kr.investing.com/commodities/crude-oil" },
            { id: "btc", label: "BTC", url: "https://kr.investing.com/crypto/bitcoin" },
            { id: "eth", label: "ETH", url: "https://kr.investing.com/crypto/ethereum" },
          ]},
          { label: "환율", color: "#16A34A", items: [
            { id: "usdkrw", label: "달러/원", url: "https://kr.investing.com/currencies/usd-krw" },
            { id: "usdjpy", label: "달러/엔", url: "https://kr.investing.com/currencies/usd-jpy" },
            { id: "dxy", label: "DXY", url: "https://kr.investing.com/indices/usdollar" },
          ]},
        ];
        const nextTime = (() => {
          const now = new Date();
          const h = now.getHours(), m = now.getMinutes();
          if (h < 6 || (h === 6 && m < 30)) return "오전 6:30";
          if (h < 16) return "오후 4:00";
          return "내일 오전 6:30";
        })();
        const renderCard = (idx) => {
          const d = yd[idx.id];
          const manualVal = manualBonds[idx.id];
          const isManual = idx.manual;
          const isEditing = editingBondId === idx.id;
          const displayVal = d ? (Number(d.price) > 999 ? Number(d.price).toLocaleString("en", {maximumFractionDigits:0}) : d.price) : (isManual && manualVal) ? manualVal : null;
          const displayChg = d?.change || null;

          if (isEditing) {
            return (
              <div key={idx.id} style={{ background: C.card, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "6px 4px", textAlign: "center" }}>
                <a href={idx.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: C.textDim, marginBottom: 2, textDecoration: "none", display: "block" }}>{idx.label}</a>
                <input style={{ width: "90%", fontSize: 10, fontFamily: C.mono, border: `1px solid ${C.border}`, borderRadius: 3, padding: "2px 4px", textAlign: "center", outline: "none" }}
                  value={bondInput} onChange={(e) => setBondInput(e.target.value)} autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && bondInput.trim()) saveManualBond(idx.id, bondInput.trim()); if (e.key === "Escape") setEditingBondId(null); }}
                  placeholder="금리 입력" />
                <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 2 }}>
                  <button style={{ fontSize: 8, padding: "1px 6px", background: C.accent, color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }} onClick={() => bondInput.trim() && saveManualBond(idx.id, bondInput.trim())}>저장</button>
                  <button style={{ fontSize: 8, padding: "1px 6px", background: C.bg, color: C.textDim, border: `1px solid ${C.border}`, borderRadius: 3, cursor: "pointer" }} onClick={() => setEditingBondId(null)}>취소</button>
                </div>
              </div>
            );
          }

          if (!displayVal) {
            return (
              <div key={idx.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 4px", textAlign: "center" }}>
                {isManual ? (
                  <>
                    <a href={idx.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: C.textDim, textDecoration: "none", display: "block" }}>{idx.label}</a>
                    <div style={{ fontSize: 9, color: C.accent, cursor: "pointer" }} onClick={() => { setEditingBondId(idx.id); setBondInput(manualVal || ""); }}>클릭하여 입력</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 8, color: C.textDim }}>{idx.label}</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>—</div>
                  </>
                )}
              </div>
            );
          }

          const isUp = displayChg?.includes("+");
          const isDown = displayChg?.includes("-");
          if (isManual) {
            return (
              <div key={idx.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 4px", textAlign: "center", position: "relative" }}>
                <a href={idx.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: C.textDim, marginBottom: 1, textDecoration: "none", display: "block", cursor: "pointer" }}
                  onClick={(e) => e.stopPropagation()}>{idx.label}</a>
                <div style={{ cursor: "pointer" }} onClick={() => { setEditingBondId(idx.id); setBondInput(manualVal || displayVal); }}>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: C.mono, color: C.text }}>{displayVal}<span style={{ fontSize: 6, color: "#F59E0B", marginLeft: 2 }}>✎</span></div>
                  {displayChg && <div style={{ fontSize: 8, fontWeight: 600, fontFamily: C.mono, color: isUp ? C.up : isDown ? C.down : C.textDim }}>{displayChg}</div>}
                </div>
              </div>
            );
          }
          return (
            <a key={idx.id} href={idx.url} target="_blank" rel="noopener noreferrer"
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 4px", textAlign: "center", textDecoration: "none", cursor: "pointer", position: "relative" }}>
              <div style={{ fontSize: 8, color: C.textDim, marginBottom: 1 }}>{idx.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: C.mono, color: C.text }}>{displayVal}</div>
              {displayChg && <div style={{ fontSize: 8, fontWeight: 600, fontFamily: C.mono, color: isUp ? C.up : isDown ? C.down : C.textDim }}>{displayChg}</div>}
            </a>
          );
        };
        return (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ ...H.section, margin: 0 }}>시장 현황</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {hasData && <span style={{ fontSize: 8, color: C.textDim }}>{autoData.fetched_at ? new Date(autoData.fetched_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " 기준" : autoData.date_key + " 기준"}</span>}
                <button style={{ background: C.accent + "10", border: `1px solid ${C.accent}30`, borderRadius: 4, padding: "4px 12px", fontSize: 10, color: C.accent, cursor: "pointer", fontFamily: C.sans, fontWeight: 700, opacity: refreshing ? 0.5 : 1 }} onClick={refreshMarketData} disabled={refreshing}>
                  {refreshing ? "불러오는 중..." : "↻ 새로고침"}
                </button>
              </div>
            </div>
            {hasData ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {marketGroups.map((g) => (
                  <div key={g.label}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: g.color, marginBottom: 4, letterSpacing: 0.3 }}>{g.label}</div>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(g.items.length, 4)}, 1fr)`, gap: 4 }}>
                      {g.items.map(renderCard)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "20px 16px", textAlign: "center" }}>
                <p style={{ fontSize: 12, color: C.textDim, margin: "0 0 8px" }}>아직 수집된 시장 데이터가 없습니다</p>
                <button style={{ background: C.accent + "10", border: `1px solid ${C.accent}30`, borderRadius: 4, padding: "6px 16px", fontSize: 11, color: C.accent, cursor: "pointer", fontFamily: C.sans, fontWeight: 700, opacity: refreshing ? 0.5 : 1 }} onClick={refreshMarketData} disabled={refreshing}>
                  {refreshing ? "불러오는 중..." : "↻ 수집 데이터 불러오기"}
                </button>
                <p style={{ fontSize: 10, color: C.textDim, margin: "6px 0 0" }}>수치갱신 후 이 버튼을 눌러주세요</p>
              </div>
            )}
            <p style={{ fontSize: 7, color: C.textDim, margin: "4px 0 0", textAlign: "center", lineHeight: 1.4 }}>
              실시간 데이터가 아닙니다. 매일 오전 6:30 / 오후 4:00 (KST) 기준 수집. 수치를 클릭하면 상세 페이지로 이동합니다.
            </p>
          </div>
        );
      })()}

      {/* Economic Calendar — investing.com widget */}
      <div style={{ marginBottom: 14 }}>
        <p style={H.section}>주요 경제 일정</p>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <iframe
            src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=2,3&countries=5,11,37,72,35&calType=week&timeZone=88&lang=12"
            width="100%"
            height="400"
            frameBorder="0"
            allowtransparency="true"
            style={{ display: "block", border: "none", minWidth: 600 }}
          />
        </div>
        <p style={{ fontSize: 7, color: C.textDim, margin: "4px 0 0", textAlign: "center" }}>
          Powered by Investing.com · 중요도 ★★~★★★ · 미국/한국/일본/유로/중국
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showNotes ? 8 : 0, cursor: "pointer" }} onClick={() => setShowNotes(!showNotes)}>
        <p style={{ ...H.section, margin: 0 }}>내 투자 노트</p>
        <span style={{ fontSize: 10, color: C.textDim }}>{showNotes ? "\u25B2" : "\u25BC"}</span>
      </div>
      {showNotes && (
        <div style={{ ...H.nav, marginBottom: 16 }}>
          <div style={H.navCard("#2563EB")} onClick={() => setPage("journal")}><div style={H.navIcon("#2563EB")}>{Icons.edit}</div><div><span style={H.navTitle}>투자 일지</span><span style={H.navDesc}>{journalCount}개</span></div></div>
          <div style={H.navCard("#6554C0")} onClick={() => setPage("scrap")}><div style={H.navIcon("#6554C0")}>{Icons.bookmark}</div><div><span style={H.navTitle}>신문 스크랩</span><span style={H.navDesc}>{scraps.length}개</span></div></div>
          <div style={H.navCard("#FF5630")} onClick={() => setPage("reports")}><div style={H.navIcon("#FF5630")}>{Icons.file}</div><div><span style={H.navTitle}>레포트</span><span style={H.navDesc}>{reports.length}개</span></div></div>
          <div style={H.navCard("#16A34A")} onClick={() => setPage("indicators")}><div style={H.navIcon("#16A34A")}>{Icons.activity}</div><div><span style={H.navTitle}>경제 지표</span><span style={H.navDesc}>{indCount}개</span></div></div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showRoutine ? 8 : 0, cursor: "pointer" }}>
        <p style={{ ...H.section, margin: 0 }} onClick={() => setShowRoutine(!showRoutine)}>오늘의 루틴 <span style={{ fontSize: 10, color: C.textDim }}>{showRoutine ? "\u25B2" : "\u25BC"}</span></p>
        {showRoutine && <button style={{ background: "none", border: "none", color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: C.sans }} onClick={() => setShowLinkEditor(!showLinkEditor)}>
          {showLinkEditor ? "완료" : "편집"}
        </button>}
      </div>

      {showRoutine && links.map((link, i) => (
        <div key={link.id} style={H.linkRow}>
          {showLinkEditor && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4 }}>
              <button onClick={() => moveLink(i, -1)} style={{ background: "none", border: "none", color: i === 0 ? C.border : C.textDim, cursor: "pointer", padding: 0, fontSize: 10, lineHeight: 1 }}>{"\u25B2"}</button>
              <button onClick={() => moveLink(i, 1)} style={{ background: "none", border: "none", color: i === links.length - 1 ? C.border : C.textDim, cursor: "pointer", padding: 0, fontSize: 10, lineHeight: 1 }}>{"\u25BC"}</button>
            </div>
          )}
          <span style={H.linkNum}>{i + 1}</span>
          <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none", color: C.text, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>{link.label}</a>
          {showLinkEditor ? (
            <button onClick={() => removeLink(link.id)} style={{ background: "none", border: "none", color: C.down, cursor: "pointer", padding: 2, display: "flex" }}>{Icons.x}</button>
          ) : (
            <span style={{ color: C.textDim, display: "flex" }}>{Icons.extLink}</span>
          )}
        </div>
      ))}

      {showRoutine && showLinkEditor && (
        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
          <input style={{ ...S.indexInput, fontSize: 11, maxWidth: 100 }} placeholder="이름" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input style={{ ...S.indexInput, fontSize: 11, flex: 1 }} placeholder="URL (https://...)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <button style={{ ...S.addChip, background: C.accent, color: "#fff", borderColor: C.accent, padding: "5px 10px" }} onClick={addLink}>추가</button>
        </div>
      )}
    </div>
  );
}

/* ═══ SCRAP PAGE ═══ */
function ScrapPage({ scraps, setScraps, showToast }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", url: "", summary: "", memo: "", category: "securities", tags: "" });

  const resetForm = () => { setForm({ title: "", url: "", summary: "", memo: "", category: "securities", tags: "" }); setEditingId(null); setShowForm(false); };

  const saveScrap = () => {
    if (!form.title.trim()) { showToast("제목을 입력해주세요"); return; }
    const tagList = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (editingId) {
      setScraps((prev) => prev.map((s) => s.id === editingId ? { ...s, ...form, tags: tagList, updatedAt: toKey(new Date()) } : s));
      showToast("스크랩 수정됨");
    } else {
      const newScrap = { id: Date.now(), ...form, tags: tagList, createdAt: toKey(new Date()), updatedAt: toKey(new Date()) };
      setScraps((prev) => [newScrap, ...prev]);
      showToast("스크랩 추가됨");
    }
    resetForm();
  };

  const editScrap = (scrap) => {
    setForm({ title: scrap.title, url: scrap.url || "", summary: scrap.summary || "", memo: scrap.memo || "", category: scrap.category, tags: (scrap.tags || []).join(", ") });
    setEditingId(scrap.id);
    setShowForm(true);
  };

  const deleteScrap = (id) => {
    setScraps((prev) => prev.filter((s) => s.id !== id));
    showToast("스크랩 삭제됨");
  };

  const filtered = useMemo(() => {
    let list = scraps;
    if (filterCat !== "all") list = list.filter((s) => s.category === filterCat);
    if (filterDate) list = list.filter((s) => (s.createdAt || "").startsWith(filterDate));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary?.toLowerCase().includes(q) ||
        s.memo?.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [scraps, filterCat, filterDate, searchQuery]);

  const scrapDates = useMemo(() => {
    const dates = new Set();
    scraps.forEach((s) => { if (s.createdAt) dates.add(s.createdAt); });
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [scraps]);

  const catCounts = useMemo(() => {
    const counts = { all: scraps.length };
    SCRAP_CATEGORIES.forEach((c) => { counts[c.id] = scraps.filter((s) => s.category === c.id).length; });
    return counts;
  }, [scraps]);

  const getCatInfo = (id) => SCRAP_CATEGORIES.find((c) => c.id === id) || SCRAP_CATEGORIES[SCRAP_CATEGORIES.length - 1];

  return (
    <div style={{ padding: "12px 0" }}>
      {/* Search bar */}
      <div style={S.searchBar}>
        <div style={S.searchIcon}>{Icons.search}</div>
        <input style={S.searchInput} placeholder="제목, 내용, 태그로 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {searchQuery && <button style={S.searchClear} onClick={() => setSearchQuery("")}>{Icons.x}</button>}
      </div>

      {/* Category filter */}
      <div style={S.catFilter}>
        <button style={{ ...S.catBtn, ...(filterCat === "all" ? S.catBtnActive : {}) }} onClick={() => setFilterCat("all")}>
          전체 <span style={S.catBtnCount}>{catCounts.all}</span>
        </button>
        {SCRAP_CATEGORIES.map((cat) => (
          <button key={cat.id} style={{ ...S.catBtn, ...(filterCat === cat.id ? { ...S.catBtnActive, background: cat.color + "12", color: cat.color, borderColor: cat.color + "30" } : {}) }} onClick={() => setFilterCat(cat.id)}>
            {cat.label} {catCounts[cat.id] > 0 && <span style={S.catBtnCount}>{catCounts[cat.id]}</span>}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>날짜</span>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...S.indexInput, maxWidth: 150, fontSize: 12 }} />
        {filterDate && <button style={S.addChip} onClick={() => setFilterDate("")}>초기화</button>}
        {scrapDates.length > 0 && !filterDate && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
            {scrapDates.slice(0, 7).map((d) => (
              <button key={d} style={S.catBtn} onClick={() => setFilterDate(d)}>{d.slice(5)}</button>
            ))}
          </div>
        )}
      </div>

      {/* Add button */}
      <button style={S.scrapAddBtn} onClick={() => { resetForm(); setShowForm(true); }}>
        {Icons.plus} 새 스크랩 추가
      </button>

      {/* Form */}
      {showForm && (
        <div style={S.scrapForm}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{editingId ? "스크랩 수정" : "새 스크랩"}</span>
            <button style={S.searchClear} onClick={resetForm}>{Icons.x}</button>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>제목 *</label>
            <input style={S.inputSmall} placeholder="기사 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>링크</label>
            <input style={S.inputSmall} placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>카테고리</label>
            <div style={S.catSelectGrid}>
              {SCRAP_CATEGORIES.map((cat) => (
                <button key={cat.id} style={{ ...S.catSelectBtn, ...(form.category === cat.id ? { background: cat.color + "15", color: cat.color, borderColor: cat.color + "40", fontWeight: 600 } : {}) }} onClick={() => setForm({ ...form, category: cat.id })}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>요약</label>
            <textarea style={S.textarea} rows={3} placeholder="기사 핵심 내용 요약..." value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>내 메모</label>
            <textarea style={S.textarea} rows={2} placeholder="기사에 대한 내 생각, 투자 아이디어..." value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>태그 (쉼표로 구분)</label>
            <input style={S.inputSmall} placeholder="예: 금리, 반도체, 실적" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={S.formSaveBtn} onClick={saveScrap}>{editingId ? "수정 완료" : "스크랩 저장"}</button>
            <button style={S.formCancelBtn} onClick={resetForm}>취소</button>
          </div>
        </div>
      )}

      {/* Scrap list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{Icons.bookmark}</div>
            <p style={{ fontSize: 14, margin: 0 }}>{searchQuery || filterCat !== "all" ? "검색 결과가 없습니다" : "아직 스크랩이 없습니다"}</p>
            <p style={{ fontSize: 12, margin: "4px 0 0", color: C.textDim }}>위 버튼을 눌러 첫 스크랩을 추가해보세요</p>
          </div>
        )}
        {filtered.map((scrap) => {
          const catInfo = getCatInfo(scrap.category);
          return (
            <div key={scrap.id} style={S.scrapCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ ...S.scrapCatBadge, background: catInfo.color + "12", color: catInfo.color }}>{catInfo.label}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{scrap.createdAt}</span>
                  </div>
                  <h3 style={S.scrapTitle}>{scrap.title}</h3>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={S.scrapActionBtn} onClick={() => editScrap(scrap)}>{Icons.edit}</button>
                  <button style={{ ...S.scrapActionBtn, color: C.down }} onClick={() => deleteScrap(scrap.id)}>{Icons.trash}</button>
                </div>
              </div>
              {scrap.url && (
                <a href={scrap.url} target="_blank" rel="noopener noreferrer" style={S.scrapLink}>
                  {Icons.link} <span>{scrap.url.length > 50 ? scrap.url.slice(0, 50) + "..." : scrap.url}</span>
                </a>
              )}
              {scrap.summary && <p style={S.scrapSummary}>{scrap.summary}</p>}
              {scrap.memo && <div style={S.scrapMemo}><span style={{ fontWeight: 600, fontSize: 11, color: C.accent, marginBottom: 2, display: "block" }}>내 메모</span>{scrap.memo}</div>}
              {scrap.tags?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {scrap.tags.map((tag, i) => <span key={i} style={S.scrapTag}>#{tag}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ INDICATORS PAGE ═══ */
const INDICATOR_DEFS = [
  { cat: "금리", items: [
    { id: "us_rate", name: "미국 기준금리", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/interest-rate-decision-168", desc: "연준(Fed) 목표금리 상단. FOMC에서 결정하는 정책금리" },
    { id: "cn_lpr1y", name: "중국 LPR 1년", unit: "%", country: "cn", url: "https://kr.investing.com/economic-calendar/pboc-loan-prime-rate-1967", desc: "대출우대금리(LPR) 1년물. 일반 대출금리의 기준" },
    { id: "cn_rrr", name: "중국 예금지준율", unit: "%", country: "cn", url: "https://kr.investing.com/economic-calendar/pboc-reserve-requirement-ratio-1084", desc: "은행이 중앙은행에 의무 예치해야 하는 예금 비율" },
    { id: "cn_lpr5y", name: "중국 LPR 5년", unit: "%", country: "cn", url: "https://kr.investing.com/economic-calendar/china-loan-prime-rate-5y-2225", desc: "5년물 LPR. 주택담보대출의 기준금리" },
    { id: "kr_rate", name: "한국 기준금리", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-interest-rate-decision-473", desc: "한국은행 금통위가 결정하는 기준금리" },
    { id: "jp_rate", name: "일본 기준금리", unit: "%", country: "jp", url: "https://kr.investing.com/economic-calendar/interest-rate-decision-165", desc: "일본은행(BOJ) 정책금리" },
    { id: "eu_rate", name: "유로 기준금리", unit: "%", country: "eu", url: "https://kr.investing.com/economic-calendar/interest-rate-decision-164", desc: "유럽중앙은행(ECB) 주요 재융자 금리" },
  ]},
  { cat: "물가/경기", items: [
    { id: "us_cpi", name: "미국 CPI", tag: "YoY", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/cpi-733", desc: "소비자물가지수 전년동월대비 변화율" },
    { id: "us_core_cpi", name: "미국 근원CPI", tag: "YoY", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/core-cpi-736", desc: "식품·에너지 제외 CPI 전년동월대비" },
    { id: "us_pce", name: "미국 PCE", tag: "YoY", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/pce-price-index-906", desc: "개인소비지출 물가 전년동월대비. Fed가 가장 중시" },
    { id: "us_core_pce", name: "미국 근원PCE", tag: "YoY", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/core-pce-price-index-905", desc: "식품·에너지 제외 PCE 전년동월대비. Fed 2% 목표" },
    { id: "kr_cpi", name: "한국 CPI", tag: "YoY", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-cpi-467", desc: "한국 소비자물가 전년동월대비 변화율" },
    { id: "kr_core_cpi", name: "한국 근원물가", tag: "YoY", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-cpi-467", desc: "농산물·석유류 제외 물가 전년동월대비" },
    { id: "jp_cpi", name: "일본 CPI", tag: "YoY", unit: "%", country: "jp", url: "https://kr.investing.com/economic-calendar/national-cpi-992", desc: "일본 소비자물가 전년동월대비" },
    { id: "eu_cpi", name: "유로 CPI", tag: "YoY", unit: "%", country: "eu", url: "https://kr.investing.com/economic-calendar/cpi-68", desc: "유로존 소비자물가 전년동월대비" },
    { id: "us_retail", name: "미국 소매판매", tag: "MoM", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/retail-sales-256", desc: "월간 소매판매 전월대비 증감률" },
    { id: "us_ism", name: "미국 ISM PMI", tag: "제조업", unit: "pt", country: "us", url: "https://kr.investing.com/economic-calendar/ism-manufacturing-pmi-173", desc: "구매관리자지수. 50 이상=확장, 미만=수축" },
    { id: "us_ppi", name: "미국 PPI", tag: "YoY", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/ppi-734", desc: "생산자물가 전년동월대비. CPI 선행지표" },
    { id: "kr_ppi", name: "한국 PPI", tag: "YoY", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-ppi-747", desc: "한국 생산자물가 전년동월대비" },
  ]},
  { cat: "고용", items: [
    { id: "us_nfp", name: "미국 비농업고용", tag: "MoM변동", unit: "천명", country: "us", url: "https://kr.investing.com/economic-calendar/nonfarm-payrolls-227", desc: "전월대비 비농업 신규 고용자 수 변동" },
    { id: "us_adp", name: "미국 ADP 고용", tag: "MoM변동", unit: "천명", country: "us", url: "https://kr.investing.com/economic-calendar/adp-nonfarm-employment-change-1", desc: "ADP 민간고용 전월대비 변동. NFP 선행지표" },
    { id: "us_unemp", name: "미국 실업률", unit: "%", country: "us", url: "https://kr.investing.com/economic-calendar/unemployment-rate-300", desc: "경제활동인구 중 실업자 비율" },
    { id: "us_claims", name: "실업수당 청구", tag: "주간", unit: "천건", country: "us", url: "https://kr.investing.com/economic-calendar/initial-jobless-claims-294", desc: "주간 신규 실업수당 청구건수" },
    { id: "kr_unemp", name: "한국 실업률", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-unemployment-rate-469", desc: "통계청 경제활동인구조사 기준 실업률" },
    { id: "us_jolts", name: "JOLTS 구인건수", unit: "천건", country: "us", url: "https://kr.investing.com/economic-calendar/jolts-job-openings-1057", desc: "월간 구인건수. 노동시장 수요 측정" },
  ]},
  { cat: "기타", items: [
    { id: "oil_inv", name: "원유재고", tag: "주간변동", unit: "천배럴", country: "us", url: "https://kr.investing.com/economic-calendar/crude-oil-inventories-75", desc: "미국 원유재고 주간 변동량" },
    { id: "kr_gdp_qq", name: "한국 GDP", tag: "QoQ", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/gdp-471", desc: "전분기 대비 GDP 성장률" },
    { id: "kr_gdp_yy", name: "한국 GDP", tag: "YoY", unit: "%", country: "kr", url: "https://kr.investing.com/economic-calendar/south-korean-gdp-745", desc: "전년동기 대비 GDP 성장률" },
    { id: "cn_gdp_yy", name: "중국 GDP", tag: "YoY", unit: "%", country: "cn", url: "https://kr.investing.com/economic-calendar/chinese-gdp-461", desc: "전년동기 대비 중국 GDP 성장률" },
  ]},
];

const CAT_COLORS = { "금리": "#3B6FF5", "물가/경기": "#E8590C", "고용": "#0E9F6E", "기타": "#9333EA" };

const AUTO_IDS = new Set(["us_rate","us_cpi","us_core_cpi","us_pce","us_core_pce","us_ppi","us_retail","us_unemp","us_nfp","us_claims","us_jolts","eu_rate","jp_rate","jp_cpi","eu_cpi","kr_cpi","kr_core_cpi","kr_rate","kr_ppi","kr_unemp","us_ism","us_adp","cn_lpr1y","cn_lpr5y","cn_rrr","oil_inv","kr_gdp_qq","kr_gdp_yy","cn_gdp_yy"]);

const COUNTRY_META = [
  { id: "us", flag: "\u{1f1fa}\u{1f1f8}", name: "미국", color: "#3B6FF5" },
  { id: "kr", flag: "\u{1f1f0}\u{1f1f7}", name: "한국", color: "#E02D3C" },
  { id: "cn", flag: "\u{1f1e8}\u{1f1f3}", name: "중국", color: "#E8590C" },
  { id: "jp", flag: "\u{1f1ef}\u{1f1f5}", name: "일본", color: "#9333EA" },
  { id: "eu", flag: "\u{1f1ea}\u{1f1fa}", name: "유로존", color: "#0891B2" },
];

const ALL_ITEMS = INDICATOR_DEFS.flatMap((g) => g.items.map((item) => ({ ...item, cat: g.cat })));

const COUNTRY_GROUPS = COUNTRY_META.map((c) => ({
  ...c,
  items: ALL_ITEMS.filter((item) => item.country === c.id),
})).filter((g) => g.items.length > 0);

function MiniChart({ data, color, width = 160, height = 48 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => parseFloat(d.value)).filter((v) => !isNaN(v));
  if (vals.length < 2) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  // Surprise colors for dots
  const dotColors = data.map((d) => {
    if (d.surprise === "positive") return C.up;
    if (d.surprise === "negative") return C.down;
    return color;
  });
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * w;
        const y = pad + h - ((v - min) / range) * h;
        const isLast = i === vals.length - 1;
        const dc = dotColors[i] || color;
        return <circle key={i} cx={x} cy={y} r={isLast ? 3 : 1.5} fill={isLast ? dc : dc + "CC"} />;
      })}
    </svg>
  );
}

function IndicatorsPage({ indicators, setIndicators, showToast, autoData }) {
  const [filterCat, setFilterCat] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [viewBy, setViewBy] = useState("cat");
  const [editingId, setEditingId] = useState(null);
  const [formDate, setFormDate] = useState(toKey(new Date()));
  const [formValue, setFormValue] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [chartPeriod, setChartPeriod] = useState("all");
  const [editingRecord, setEditingRecord] = useState(null);
  const [editRecordVal, setEditRecordVal] = useState("");
  const [pins, setPins] = useState(indicators?._pins || []);
  const [collapsed, setCollapsed] = useState({});
  const [autoSynced, setAutoSynced] = useState(false);

  // Auto-collectible indicator IDs — all indicators are now auto via investing.com
  const isAutoIndicator = (id) => AUTO_IDS.has(id);

  const investingData = autoData?.investing_data || {};

  const [syncLoading, setSyncLoading] = useState(false);

  const syncAutoData = () => {
    setSyncLoading(true);
    let count = 0;
    const next = { ...indicators };

    // Investing.com 데이터 → indicators 형식으로 변환
    for (const [id, data] of Object.entries(investingData)) {
      if (!data?.records || data.records.length === 0) continue;
      const newRecords = data.records
        .filter(r => r.actual !== null && r.actual !== undefined)
        .map(r => ({
          date: r.date,
          value: String(r.actual),
          forecast: r.forecast != null ? String(r.forecast) : null,
          previous: r.previous != null ? String(r.previous) : null,
          surprise: r.surprise || "neutral",
          period: r.period || "",
        }));

      if (newRecords.length > 0) {
        // 기존 수동 입력 데이터 병합 (수동 입력은 보존)
        const existingManual = (next[id] || []).filter(r => r._manual);
        const allRecords = [...newRecords];
        for (const mr of existingManual) {
          if (!allRecords.find(r => r.date === mr.date)) allRecords.push(mr);
        }
        allRecords.sort((a, b) => a.date.localeCompare(b.date));
        next[id] = allRecords;
        count += newRecords.length;
      }

      // 다음 발표 예정일 + forecast 저장
      if (data.next_date) {
        next[`_next_${id}`] = {
          date: data.next_date,
          time: data.next_time,
          forecast: data.next_forecast,
          previous: data.next_previous,
        };
      }
    }

    // 단위 정보 저장
    for (const [id, data] of Object.entries(investingData)) {
      if (data?.unit) next[`_unit_${id}`] = data.unit;
    }

    setIndicators(next);
    try { window.storage.set("eco-indicators", JSON.stringify(next)); } catch(e){}

    setTimeout(() => {
      setSyncLoading(false);
      showToast(count > 0 ? `${count}개 지표 업데이트됨 (Investing.com)` : "새로운 데이터가 없습니다 (이미 최신)");
    }, 300);
  };

  // 페이지 열릴 때 자동 동기화 하지 않음 — "자동 입력" 버튼을 눌러야만 반영
  useEffect(() => {
    if (!autoSynced && autoData) {
      setAutoSynced(true);
    }
  }, [autoData, autoSynced]);

  const togglePin = (id) => {
    const nextPins = pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id];
    setPins(nextPins);
    const nextInd = { ...indicators, _pins: nextPins };
    setIndicators(nextInd);
    try { window.storage.set("eco-indicators", JSON.stringify(nextInd)); } catch(e){}
  };
  const toggleCollapse = (key) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const addRecord = (id) => {
    if (!formValue.trim()) { showToast("값을 입력해주세요"); return; }
    const prev = { ...indicators };
    const records = [...(prev[id] || [])];
    const exists = records.findIndex((r) => r.date === formDate);
    if (exists >= 0) { records[exists] = { date: formDate, value: formValue.trim() }; }
    else { records.push({ date: formDate, value: formValue.trim() }); }
    records.sort((a, b) => a.date.localeCompare(b.date));
    const next = { ...prev, [id]: records };
    setIndicators(next);
    try { window.storage.set("eco-indicators", JSON.stringify(next)); } catch(e){}
    showToast("기록됨");
    setEditingId(null);
    setFormValue("");
  };

  const deleteRecord = (id, date) => {
    const next = { ...indicators, [id]: (indicators[id] || []).filter((r) => r.date !== date) };
    setIndicators(next);
    try { window.storage.set("eco-indicators", JSON.stringify(next)); } catch(e){}
    showToast("삭제됨");
  };

  const updateRecord = (id, oldDate, newVal) => {
    if (!newVal.trim()) return;
    const next = { ...indicators, [id]: (indicators[id] || []).map((r) => r.date === oldDate ? { ...r, value: newVal.trim() } : r) };
    setIndicators(next);
    try { window.storage.set("eco-indicators", JSON.stringify(next)); } catch(e){}
    setEditingRecord(null);
    setEditRecordVal("");
    showToast("수정됨");
  };

  const allCats = INDICATOR_DEFS.map((g) => g.cat);
  const pinnedItems = pins.length > 0 ? ALL_ITEMS.filter((item) => pins.includes(item.id)) : [];

  const getGroupsToRender = () => {
    if (viewBy === "cat") {
      const groups = filterCat === "all" ? INDICATOR_DEFS : INDICATOR_DEFS.filter((g) => g.cat === filterCat);
      return groups.map((g) => ({ key: g.cat, label: g.cat, color: CAT_COLORS[g.cat], items: g.items }));
    } else {
      const groups = filterCountry === "all" ? COUNTRY_GROUPS : COUNTRY_GROUPS.filter((g) => g.id === filterCountry);
      return groups.map((g) => ({ key: g.id, label: `${g.flag} ${g.name}`, color: g.color, items: g.items }));
    }
  };

  const fmtNum = (v) => { const n = parseFloat(v); if (isNaN(n)) return v; return n.toLocaleString("en-US", { maximumFractionDigits: 2 }); };

  const renderRow = (item, color) => {
    const records = indicators[item.id] || [];
    const latest = records.length > 0 ? records[records.length - 1] : null;
    const prev = records.length > 1 ? records[records.length - 2] : null;
    const third = records.length > 2 ? records[records.length - 3] : null;
    const isEditing = editingId === item.id;
    const isExpanded = expandedId === item.id;
    const isPinned = pins.includes(item.id);
    const isAuto = isAutoIndicator(item.id);
    let diffStr = null;
    if (latest && prev) {
      const diff = (parseFloat(latest.value) - parseFloat(prev.value)).toFixed(2);
      if (diff !== "NaN") { const isUp = diff > 0; const isDown = diff < 0; diffStr = { text: (isUp ? "+" : "") + diff, color: isUp ? C.up : isDown ? C.down : C.textDim }; }
    }
    // Surprise badge from investing.com data
    const latestSurprise = latest?.surprise;
    const surpriseBadge = latestSurprise === "positive" ? { text: "▲", color: C.up, bg: C.upBg }
      : latestSurprise === "negative" ? { text: "▼", color: C.down, bg: C.downBg }
      : null;
    // Forecast from latest record
    const latestForecast = latest?.forecast;
    // Next release info
    const nextInfo = indicators[`_next_${item.id}`];

    return (
      <div key={item.id}>
        <div style={S.tblRow}>
          <button style={{ ...S.pinBtn, color: isPinned ? "#F59E0B" : C.borderLight }} onClick={() => togglePin(item.id)} title={isPinned ? "즐겨찾기 해제" : "즐겨찾기"}>
            {isPinned ? "\u2605" : "\u2606"}
          </button>
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ ...S.tblName, display: "flex", alignItems: "center", gap: 4 }} title={item.desc}>
            {item.name}
            {item.tag && <span style={{ fontSize: 7, fontWeight: 600, color: C.accent, background: C.accentDim, padding: "1px 4px", borderRadius: 2, flexShrink: 0 }}>{item.tag}</span>}
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            {prev && <span style={{ fontSize: 9, color: C.textDim, fontFamily: C.mono, cursor: "help" }} title={`이전: ${prev.date}`}>{fmtNum(prev.value)}</span>}
            {prev && <span style={{ fontSize: 8, color: C.borderLight }}>{"\u203A"}</span>}
            {latestForecast != null && <span style={{ fontSize: 9, color: "#9333EA", fontFamily: C.mono, cursor: "help" }} title="예측">{fmtNum(latestForecast)}</span>}
            {latestForecast != null && <span style={{ fontSize: 8, color: C.borderLight }}>{"\u203A"}</span>}
            <span style={{ ...S.tblVal, minWidth: "auto", cursor: latest ? "help" : "default" }} title={latest?.date || ""}>{latest ? fmtNum(latest.value) + item.unit : "—"}</span>
          </div>
          {surpriseBadge ? (
            <span style={{ ...S.tblDiff, color: surpriseBadge.color, background: surpriseBadge.bg, padding: "1px 4px", borderRadius: 3, fontSize: 9 }}>{surpriseBadge.text}</span>
          ) : diffStr ? (
            <span style={{ ...S.tblDiff, color: diffStr.color }}>{diffStr.text}</span>
          ) : <span style={S.tblDiff}>—</span>}
          <span style={S.tblDate}>{latest ? latest.date.slice(5) : ""}</span>
          <div style={{ width: 64, flexShrink: 0 }}>{records.length >= 2 && <MiniChart data={records} color={color} width={64} height={24} />}</div>
          <button style={S.tblBtn} onClick={() => { setEditingId(isEditing ? null : item.id); setFormValue(""); setFormDate(toKey(new Date())); }} title="기록">{isEditing ? Icons.x : Icons.plus}</button>
          {records.length > 0 && <button style={S.tblBtn} onClick={() => { setExpandedId(isExpanded ? null : item.id); setChartPeriod("all"); }} title="상세">{Icons.barChart}</button>}
        </div>
        {isEditing && (
          <div style={S.tblEditRow}>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} style={{ ...S.indexInput, maxWidth: 130, fontSize: 11 }} />
            <input style={{ ...S.indexInput, maxWidth: 90, fontSize: 11 }} placeholder={item.unit} value={formValue} onChange={(e) => setFormValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRecord(item.id)} autoFocus />
            <button style={{ ...S.addChip, background: C.accent, color: "#fff", borderColor: C.accent, padding: "4px 10px", fontSize: 11 }} onClick={() => addRecord(item.id)}>기록</button>
          </div>
        )}
        {isExpanded && records.length > 0 && (() => {
          const filterByPeriod = (recs, period) => {
            if (period === "all") return recs;
            const now = new Date();
            const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12, "2y": 24, "3y": 36 }[period] || 0;
            const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
            const cutoffKey = toKey(cutoff);
            return recs.filter((r) => r.date >= cutoffKey);
          };
          const periodRecords = filterByPeriod(records, chartPeriod);
          const periods = [{ id: "1y", label: "1년" }, { id: "2y", label: "2년" }, { id: "3y", label: "3년" }, { id: "all", label: "전체" }];
          return (
            <div style={S.tblDetail}>
              {/* Next release info */}
              {nextInfo?.date && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: C.accentDim, borderRadius: 4, fontSize: 11 }}>
                  <span style={{ color: C.accent, fontWeight: 600 }}>다음 발표</span>
                  <span style={{ fontFamily: C.mono, color: C.text }}>{nextInfo.date}</span>
                  {nextInfo.forecast != null && <span style={{ color: "#9333EA", fontFamily: C.mono }}>예측: {nextInfo.forecast}</span>}
                  <span style={{ color: C.textDim, fontSize: 10 }}>
                    (D{Math.ceil((new Date(nextInfo.date) - new Date()) / 86400000)})
                  </span>
                </div>
              )}
              {/* Period filter */}
              <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                {periods.map((p) => (
                  <button key={p.id} onClick={() => setChartPeriod(p.id)} style={{ ...S.addChip, ...(chartPeriod === p.id ? { background: C.accent, color: "#fff", borderColor: C.accent } : {}), padding: "3px 8px", fontSize: 10 }}>{p.label}</button>
                ))}
              </div>
              {/* Large chart with forecast dots */}
              {periodRecords.length >= 2 && <MiniChart data={periodRecords} color={color} width={Math.min(500, 460)} height={70} />}
              {periodRecords.length < 2 && <p style={{ fontSize: 11, color: C.textDim, padding: "8px 0" }}>이 기간에 데이터가 부족합니다 (2개 이상 필요)</p>}
              {/* Legend */}
              <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 9, color: C.textDim }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.up, display: "inline-block" }} />예측 상회</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.down, display: "inline-block" }} />예측 하회</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />부합</span>
              </div>
              {/* History table: date | actual | forecast | previous | surprise */}
              <div style={{ marginTop: 8, fontSize: 10, color: C.textDim }}>
                <div style={{ display: "flex", gap: 4, padding: "4px 0", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>
                  <span style={{ width: 70 }}>발표일</span>
                  <span style={{ width: 50, textAlign: "right" }}>실제</span>
                  <span style={{ width: 50, textAlign: "right", color: "#9333EA" }}>예측</span>
                  <span style={{ width: 50, textAlign: "right" }}>이전</span>
                  <span style={{ flex: 1, textAlign: "right" }}>서프라이즈</span>
                  <span style={{ width: 20 }} />
                </div>
              </div>
              <div style={{ maxHeight: 180, overflow: "auto" }}>
                {[...periodRecords].reverse().map((r) => {
                  const isEditingThis = editingRecord && editingRecord.id === item.id && editingRecord.date === r.date;
                  const sColor = r.surprise === "positive" ? C.up : r.surprise === "negative" ? C.down : C.textDim;
                  const sText = r.surprise === "positive" ? "▲ 상회" : r.surprise === "negative" ? "▼ 하회" : "— 부합";
                  return (
                    <div key={r.date} style={{ ...S.tblHistRow, fontSize: 10 }}>
                      <span style={{ color: C.textDim, fontFamily: C.mono, width: 70 }}>{r.date.slice(2)}</span>
                      {isEditingThis ? (
                        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input style={{ ...S.indexInput, maxWidth: 60, fontSize: 10, padding: "2px 4px" }} value={editRecordVal} onChange={(e) => setEditRecordVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") updateRecord(item.id, r.date, editRecordVal); if (e.key === "Escape") setEditingRecord(null); }} autoFocus />
                          <button style={{ ...S.addChip, background: C.accent, color: "#fff", borderColor: C.accent, padding: "1px 5px", fontSize: 9 }} onClick={() => updateRecord(item.id, r.date, editRecordVal)}>✓</button>
                        </span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600, fontFamily: C.mono, width: 50, textAlign: "right", cursor: "pointer" }} onClick={() => { setEditingRecord({ id: item.id, date: r.date }); setEditRecordVal(r.value); }}>{fmtNum(r.value)}</span>
                          <span style={{ fontFamily: C.mono, width: 50, textAlign: "right", color: "#9333EA" }}>{r.forecast != null ? fmtNum(r.forecast) : "—"}</span>
                          <span style={{ fontFamily: C.mono, width: 50, textAlign: "right", color: C.textDim }}>{r.previous != null ? fmtNum(r.previous) : "—"}</span>
                          <span style={{ flex: 1, textAlign: "right", fontWeight: 600, color: sColor, fontSize: 9 }}>{r.forecast != null ? sText : ""}</span>
                          <button style={{ ...S.tblBtn, opacity: 0.3, width: 20 }} onClick={() => deleteRecord(item.id, r.date)}>{Icons.trash}</button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  const groupsToRender = getGroupsToRender();

  return (
    <div style={{ padding: "12px 0" }}>
      {/* Auto sync button — Investing.com */}
      {Object.keys(investingData).length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginBottom: 10 }}>
          <button style={{ ...S.scrapAddBtn, background: syncLoading ? "#888" : "#16A34A", marginBottom: 6 }} onClick={syncAutoData} disabled={syncLoading}>
            {Icons.activity} {syncLoading ? "동기화 중..." : "경제 지표 자동 입력 (Investing.com)"}
          </button>
          <p style={{ fontSize: 8, color: C.textDim, margin: 0, textAlign: "center" }}>
            {autoData?.fetched_at ? new Date(autoData.fetched_at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " 수집" : ""} | 지표 갱신 후 이 버튼을 눌러 반영
          </p>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 9, color: C.textDim }}>
        <span>전체 지표 Investing.com에서 자동 수집</span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.up, display: "inline-block" }} />예측 상회</span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.down, display: "inline-block" }} />예측 하회</span>
      </div>

      {/* 다음 발표 예정 카드 — 즐겨찾기 지표 기준 */}
      {(() => {
        const upcomingItems = ALL_ITEMS
          .filter(item => pins.includes(item.id) && indicators[`_next_${item.id}`]?.date)
          .map(item => ({ ...item, next: indicators[`_next_${item.id}`] }))
          .sort((a, b) => (a.next.date || "").localeCompare(b.next.date || ""))
          .slice(0, 4);
        if (upcomingItems.length === 0) return null;
        return (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 0.3, marginBottom: 6 }}>다음 발표 예정</div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(upcomingItems.length, 4)}, 1fr)`, gap: 6 }}>
              {upcomingItems.map(item => {
                const dDay = Math.ceil((new Date(item.next.date) - new Date()) / 86400000);
                const cMeta = COUNTRY_META.find(c => c.id === item.country);
                return (
                  <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: C.textDim }}>{cMeta?.flag} {item.name}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: C.mono, color: dDay <= 3 ? C.down : C.text, margin: "2px 0" }}>D{dDay <= 0 ? "-day" : `-${dDay}`}</div>
                    <div style={{ fontSize: 9, color: C.textMid, fontFamily: C.mono }}>{item.next.date?.slice(5)}</div>
                    {item.next.forecast != null && <div style={{ fontSize: 8, color: "#9333EA", marginTop: 2 }}>예측: {item.next.forecast}{item.unit}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button style={{ ...S.viewToggleBtn, ...(viewBy === "cat" ? S.viewToggleBtnActive : {}) }} onClick={() => { setViewBy("cat"); setFilterCat("all"); }}>
          {Icons.layers}<span>카테고리별</span>
        </button>
        <button style={{ ...S.viewToggleBtn, ...(viewBy === "country" ? S.viewToggleBtnActive : {}) }} onClick={() => { setViewBy("country"); setFilterCountry("all"); }}>
          {Icons.globe}<span>국가별</span>
        </button>
      </div>

      {viewBy === "cat" && (
        <div style={S.catFilter}>
          <button style={{ ...S.catBtn, ...(filterCat === "all" ? S.catBtnActive : {}) }} onClick={() => setFilterCat("all")}>전체</button>
          {allCats.map((cat) => (
            <button key={cat} style={{ ...S.catBtn, ...(filterCat === cat ? { ...S.catBtnActive, background: CAT_COLORS[cat] + "12", color: CAT_COLORS[cat], borderColor: CAT_COLORS[cat] + "30" } : {}) }} onClick={() => setFilterCat(cat)}>{cat}</button>
          ))}
        </div>
      )}
      {viewBy === "country" && (
        <div style={S.catFilter}>
          <button style={{ ...S.catBtn, ...(filterCountry === "all" ? S.catBtnActive : {}) }} onClick={() => setFilterCountry("all")}>전체</button>
          {COUNTRY_META.map((c) => (
            <button key={c.id} style={{ ...S.catBtn, ...(filterCountry === c.id ? { ...S.catBtnActive, background: c.color + "12", color: c.color, borderColor: c.color + "30" } : {}) }} onClick={() => setFilterCountry(c.id)}>{c.flag} {c.name}</button>
          ))}
        </div>
      )}

      {/* Pinned favorites */}
      {pinnedItems.length > 0 && (
        <div style={S.tblSection}>
          <div style={S.tblSectionHeader} onClick={() => toggleCollapse("pinned")}>
            <span style={{ color: "#F59E0B" }}>{"\u2605"} 즐겨찾기 ({pinnedItems.length})</span>
            <span style={{ color: C.textDim, fontSize: 12 }}>{collapsed["pinned"] ? "\u25BC" : "\u25B2"}</span>
          </div>
          {!collapsed["pinned"] && (
            <div style={S.tblBody}>
              {pinnedItems.map((item) => renderRow(item, CAT_COLORS[item.cat] || C.accent))}
            </div>
          )}
        </div>
      )}

      {/* Groups */}
      {groupsToRender.map((group) => (
        <div key={group.key} style={S.tblSection}>
          <div style={S.tblSectionHeader} onClick={() => toggleCollapse(group.key)}>
            <span style={{ color: group.color }}>{group.label} ({group.items.length})</span>
            <span style={{ color: C.textDim, fontSize: 12 }}>{collapsed[group.key] ? "\u25BC" : "\u25B2"}</span>
          </div>
          {!collapsed[group.key] && (
            <div style={S.tblBody}>
              {group.items.map((item) => {
                const itemColor = viewBy === "country" ? (CAT_COLORS[item.cat] || group.color) : group.color;
                return renderRow(item, itemColor);
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══ REPORT ARCHIVE PAGE ═══ */
function ReportArchivePage({ reports, setReports, customSectors, setCustomSectors, showToast }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [filterSector, setFilterSector] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [showSectorMgr, setShowSectorMgr] = useState(false);
  const [newSectorName, setNewSectorName] = useState("");
  const [form, setForm] = useState({ title: "", source: "other", sector: "other", stocks: "", link: "", summary: "", rating: 3, date: toKey(new Date()) });

  const allSectors = useMemo(() => [...DEFAULT_REPORT_SECTORS, ...customSectors], [customSectors]);

  const addSector = () => {
    if (!newSectorName.trim()) return;
    const id = "custom_" + Date.now();
    setCustomSectors((prev) => [...prev, { id, label: newSectorName.trim() }]);
    setNewSectorName("");
    showToast("섹터 추가됨");
  };
  const removeSector = (id) => {
    setCustomSectors((prev) => prev.filter((s) => s.id !== id));
    showToast("섹터 삭제됨");
  };

  const resetForm = () => { setForm({ title: "", source: "other", sector: "other", stocks: "", link: "", summary: "", rating: 3, date: toKey(new Date()) }); setEditingId(null); setShowForm(false); };

  const saveReport = () => {
    if (!form.title.trim()) { showToast("제목을 입력해주세요"); return; }
    const stockList = form.stocks.split(",").map((s) => s.trim()).filter(Boolean);
    if (editingId) {
      setReports((prev) => prev.map((r) => r.id === editingId ? { ...r, ...form, stocks: stockList, updatedAt: toKey(new Date()) } : r));
      showToast("레포트 수정됨");
    } else {
      setReports((prev) => [{ id: Date.now(), ...form, stocks: stockList, createdAt: toKey(new Date()), updatedAt: toKey(new Date()) }, ...prev]);
      showToast("레포트 추가됨");
    }
    resetForm();
  };

  const editReport = (r) => {
    setForm({ title: r.title, source: r.source || "other", sector: r.sector || "other", stocks: (r.stocks || []).join(", "), link: r.link || "", summary: r.summary || "", rating: r.rating || 3, date: r.date || r.createdAt });
    setEditingId(r.id);
    setShowForm(true);
  };

  const deleteReport = (id) => { setReports((prev) => prev.filter((r) => r.id !== id)); showToast("삭제됨"); };

  const filtered = useMemo(() => {
    let list = reports;
    if (filterSource !== "all") list = list.filter((r) => r.source === filterSource);
    if (filterSector !== "all") list = list.filter((r) => r.sector === filterSector);
    if (filterDate) list = list.filter((r) => (r.date || r.createdAt || "").startsWith(filterDate));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q) || r.stocks?.some((s) => s.toLowerCase().includes(q)));
    }
    if (sortBy === "date") list = [...list].sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
    else if (sortBy === "rating") list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return list;
  }, [reports, filterSource, filterSector, filterDate, searchQuery, sortBy]);

  const reportDates = useMemo(() => {
    const dates = new Set();
    reports.forEach((r) => { const d = r.date || r.createdAt; if (d) dates.add(d); });
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [reports]);

  const sourceCounts = useMemo(() => {
    const c = {};
    reports.forEach((r) => { c[r.source] = (c[r.source] || 0) + 1; });
    return c;
  }, [reports]);

  const getSourceLabel = (id) => REPORT_SOURCES.find((s) => s.id === id)?.label || id;
  const getSectorLabel = (id) => allSectors.find((s) => s.id === id)?.label || id;
  const stars = (n) => "\u2605".repeat(n) + "\u2606".repeat(5 - n);

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={S.searchBar}>
        <div style={S.searchIcon}>{Icons.search}</div>
        <input style={S.searchInput} placeholder="제목, 내용, 종목명 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        {searchQuery && <button style={S.searchClear} onClick={() => setSearchQuery("")}>{Icons.x}</button>}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.textDim, lineHeight: "28px", flexShrink: 0 }}>출처</span>
        <button style={{ ...S.catBtn, ...(filterSource === "all" ? S.catBtnActive : {}) }} onClick={() => setFilterSource("all")}>전체</button>
        {REPORT_SOURCES.filter((s) => sourceCounts[s.id]).map((s) => (
          <button key={s.id} style={{ ...S.catBtn, ...(filterSource === s.id ? S.catBtnActive : {}) }} onClick={() => setFilterSource(s.id)}>
            {s.label} <span style={S.catBtnCount}>{sourceCounts[s.id]}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.textDim, lineHeight: "28px", flexShrink: 0 }}>섹터</span>
        <button style={{ ...S.catBtn, ...(filterSector === "all" ? S.catBtnActive : {}) }} onClick={() => setFilterSector("all")}>전체</button>
        {allSectors.map((s) => (
          <button key={s.id} style={{ ...S.catBtn, ...(filterSector === s.id ? S.catBtnActive : {}) }} onClick={() => setFilterSector(s.id)}>{s.label}</button>
        ))}
        <button style={{ ...S.catBtn, borderStyle: "dashed" }} onClick={() => setShowSectorMgr(!showSectorMgr)}>설정</button>
      </div>

      {showSectorMgr && (
        <div style={{ ...S.scrapForm, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>섹터 관리</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {DEFAULT_REPORT_SECTORS.map((s) => (
              <span key={s.id} style={{ ...S.catBtn, opacity: 0.6, cursor: "default" }}>{s.label} (기본)</span>
            ))}
            {customSectors.map((s) => (
              <span key={s.id} style={{ ...S.catBtn, display: "flex", alignItems: "center", gap: 4 }}>
                {s.label}
                <button style={{ background: "none", border: "none", color: C.down, cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1 }} onClick={() => removeSector(s.id)}>{Icons.x}</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input style={{ ...S.indexInput, maxWidth: 160, fontSize: 12 }} placeholder="새 섹터명" value={newSectorName} onChange={(e) => setNewSectorName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSector()} />
            <button style={{ ...S.addChip, background: C.accent, color: "#fff", borderColor: C.accent }} onClick={addSector}>추가</button>
          </div>
        </div>
      )}

      {/* Date filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.textDim, flexShrink: 0 }}>날짜</span>
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ ...S.indexInput, maxWidth: 150, fontSize: 12 }} />
        {filterDate && <button style={S.addChip} onClick={() => setFilterDate("")}>초기화</button>}
        {reportDates.length > 0 && !filterDate && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, scrollbarWidth: "none" }}>
            {reportDates.slice(0, 7).map((d) => (
              <button key={d} style={S.catBtn} onClick={() => setFilterDate(d)}>{d.slice(5)}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <button style={S.scrapAddBtn} onClick={() => { resetForm(); setShowForm(true); }}>
          {Icons.plus} 새 레포트 추가
        </button>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={{ ...S.catBtn, ...(sortBy === "date" ? S.catBtnActive : {}) }} onClick={() => setSortBy("date")}>최신순</button>
          <button style={{ ...S.catBtn, ...(sortBy === "rating" ? S.catBtnActive : {}) }} onClick={() => setSortBy("rating")}>평점순</button>
        </div>
      </div>

      {showForm && (
        <div style={S.scrapForm}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{editingId ? "레포트 수정" : "새 레포트"}</span>
            <button style={S.searchClear} onClick={resetForm}>{Icons.x}</button>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>제목 *</label>
            <input style={S.inputSmall} placeholder="레포트 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={S.cardGrid}>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>날짜</label>
              <input type="date" style={S.inputSmall} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>링크</label>
              <input style={S.inputSmall} placeholder="https://..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </div>
          </div>
          <div style={S.cardGrid}>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>출처</label>
              <select style={{ ...S.inputSmall, appearance: "auto" }} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                {REPORT_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.fieldLabel}>섹터</label>
              <select style={{ ...S.inputSmall, appearance: "auto" }} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {allSectors.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>관련 종목 (쉼표 구분)</label>
            <input style={S.inputSmall} placeholder="예: 삼성전자, SK하이닉스, TSMC" value={form.stocks} onChange={(e) => setForm({ ...form, stocks: e.target.value })} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>평점</label>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setForm({ ...form, rating: n })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: n <= form.rating ? "#F59E0B" : C.borderLight, padding: 0, lineHeight: 1 }}>{n <= form.rating ? "\u2605" : "\u2606"}</button>
              ))}
            </div>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>핵심 요약 / 메모</label>
            <textarea style={S.textarea} rows={4} placeholder="레포트의 핵심 내용, 투자 아이디어, 시사점..." value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button style={S.formSaveBtn} onClick={saveReport}>{editingId ? "수정 완료" : "레포트 저장"}</button>
            <button style={S.formCancelBtn} onClick={resetForm}>취소</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textDim }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{Icons.file}</div>
            <p style={{ fontSize: 14, margin: 0 }}>{searchQuery || filterSource !== "all" || filterSector !== "all" || filterDate ? "검색 결과가 없습니다" : "아직 저장된 레포트가 없습니다"}</p>
          </div>
        )}
        {filtered.map((r) => (
          <div key={r.id} style={S.scrapCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ ...S.scrapCatBadge, background: "#3B6FF5" + "12", color: "#3B6FF5" }}>{getSourceLabel(r.source)}</span>
                  <span style={{ ...S.scrapCatBadge, background: "#9333EA" + "12", color: "#9333EA" }}>{getSectorLabel(r.sector)}</span>
                  <span style={{ fontSize: 11, color: "#F59E0B", letterSpacing: -1 }}>{stars(r.rating || 3)}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>{r.date || r.createdAt}</span>
                </div>
                <h3 style={S.scrapTitle}>{r.title}</h3>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button style={S.scrapActionBtn} onClick={() => editReport(r)}>{Icons.edit}</button>
                <button style={{ ...S.scrapActionBtn, color: C.down }} onClick={() => deleteReport(r.id)}>{Icons.trash}</button>
              </div>
            </div>
            {r.link && (
              <a href={r.link} target="_blank" rel="noopener noreferrer" style={S.scrapLink}>
                {Icons.link} <span>{r.link.length > 55 ? r.link.slice(0, 55) + "..." : r.link}</span>
              </a>
            )}
            {r.summary && <p style={S.scrapSummary}>{r.summary}</p>}
            {r.stocks?.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                {r.stocks.map((s, i) => <span key={i} style={{ ...S.scrapTag, color: "#0E9F6E" }}>{s}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ DATA MANAGER ═══ */
function DataManager({ entries, setEntries, scraps, setScraps, indicators, setIndicators, reports, setReports, getStorageSize, showToast, setAutoData, autoData, onClose }) {
  const [tab, setTab] = useState("overview");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPage, setSelectedPage] = useState("all");
  const [scrapCatFilter, setScrapCatFilter] = useState("all");
  const [confirmText, setConfirmText] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  const sizes = getStorageSize();
  const totalMB = (sizes.total / 1024 / 1024).toFixed(2);
  const pct = ((sizes.total / (500 * 1024 * 1024)) * 100).toFixed(2);
  const formatSize = (b) => b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB";

  const pageInfo = [
    { id: "entries", label: "투자 일지", size: sizes.entries, count: Object.keys(entries).filter(k => entries[k] && Object.keys(entries[k]).length > 0).length, unit: "일" },
    { id: "scraps", label: "신문 스크랩", size: sizes.scraps, count: scraps.length, unit: "개" },
    { id: "indicators", label: "경제 지표", size: sizes.indicators, count: Object.keys(indicators).filter(k => !k.startsWith("_") && indicators[k]?.length > 0).length, unit: "개 지표" },
    { id: "reports", label: "레포트", size: sizes.reports, count: reports.length, unit: "개" },
    { id: "autoData", label: "수집 데이터 (auto_data)", size: sizes.autoData || 0, count: autoData ? 1 : 0, unit: "회 수집" },
  ];

  const execAction = (action) => {
    setPendingAction(action);
    setConfirmText("");
  };

  // Supabase에 직접 저장하는 헬퍼
  const saveToDb = (key, data) => { try { window.storage.set(key, JSON.stringify(data)); } catch(e){} };

  const confirmAction = () => {
    if (confirmText !== "삭제") return;
    const a = pendingAction;
    if (!a) return;

    if (a.type === "page") {
      if (a.id === "entries") { setEntries({}); saveToDb("journal-entries", {}); }
      else if (a.id === "scraps") { setScraps([]); saveToDb("news-scraps", []); }
      else if (a.id === "indicators") { const pins = indicators._pins; const cleared = pins ? { _pins: pins } : {}; setIndicators(cleared); saveToDb("eco-indicators", cleared); }
      else if (a.id === "reports") { setReports([]); saveToDb("report-archive", []); }
      showToast(`${a.label} 데이터 삭제됨`);
    }
    else if (a.type === "dateRange") {
      if (!dateFrom && !dateTo) { showToast("날짜를 선택해주세요"); setPendingAction(null); return; }
      const from = dateFrom || "0000-00-00";
      const to = dateTo || "9999-99-99";
      if (selectedPage === "all" || selectedPage === "entries") {
        const n = {}; Object.entries(entries).forEach(([k, v]) => { if (k < from || k > to) n[k] = v; });
        setEntries(n); saveToDb("journal-entries", n);
      }
      if (selectedPage === "all" || selectedPage === "scraps") {
        const n = scraps.filter(s => { const d = s.createdAt || ""; return d < from || d > to; });
        setScraps(n); saveToDb("news-scraps", n);
      }
      if (selectedPage === "all" || selectedPage === "reports") {
        const n = reports.filter(r => { const d = r.date || r.createdAt || ""; return d < from || d > to; });
        setReports(n); saveToDb("report-archive", n);
      }
      if (selectedPage === "all" || selectedPage === "indicators") {
        const n = { ...indicators };
        Object.keys(n).forEach(k => { if (k.startsWith("_")) return; if (Array.isArray(n[k])) n[k] = n[k].filter(r => r.date < from || r.date > to); });
        setIndicators(n); saveToDb("eco-indicators", n);
      }
      showToast(`${from} ~ ${to} 기간 데이터 삭제됨`);
    }
    else if (a.type === "scrapCat") {
      const n = scraps.filter(s => s.category !== a.catId);
      setScraps(n); saveToDb("news-scraps", n);
      showToast(`"${a.catLabel}" 카테고리 스크랩 삭제됨`);
    }
    else if (a.type === "emptyEntries") {
      const n = {};
      Object.entries(entries).forEach(([k, v]) => {
        if (v.memo || v.markets?.some(m => m.value || m.change) || v.bonds?.some(b => b.yield || b.change) || v.sectors?.some(s => s.name) || v.stocks?.some(s => s.name)) n[k] = v;
      });
      setEntries(n); saveToDb("journal-entries", n);
      showToast("빈 일지 삭제됨");
    }
    else if (a.type === "indicatorId") {
      const n = { ...indicators }; delete n[a.indId];
      setIndicators(n); saveToDb("eco-indicators", n);
      showToast(`"${a.indName}" 기록 삭제됨`);
    }
    else if (a.type === "reportFilter") {
      let n;
      if (a.filterType === "source") n = reports.filter(r => r.source !== a.filterValue);
      else if (a.filterType === "rating") n = reports.filter(r => (r.rating || 3) > a.filterValue);
      else n = reports;
      setReports(n); saveToDb("report-archive", n);
      showToast("필터된 레포트 삭제됨");
    }
    else if (a.type === "autoData") {
      (async () => {
        if (window.clearAutoData) {
          const ok = await window.clearAutoData();
          if (ok) {
            setAutoData(null);
            showToast("수집 데이터(auto_data) 전부 삭제됨. 수치갱신을 다시 눌러주세요.");
          } else {
            showToast("삭제 실패. Supabase 연결을 확인해주세요.");
          }
        }
      })();
    }
    setPendingAction(null);
    setConfirmText("");
  };

  const exportData = () => {
    const data = { entries, scraps, indicators, reports, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `invest-note-backup-${toKey(new Date())}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast("데이터 백업 다운로드됨");
  };

  const MS = {
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    modal: { background: C.card, borderRadius: 8, width: "100%", maxWidth: 500, maxHeight: "85vh", overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, background: C.card, zIndex: 1 },
    body: { padding: "16px 20px" },
    tabs: { display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", scrollbarWidth: "none" },
    bar: { height: 8, borderRadius: 4, background: C.border, overflow: "hidden", marginBottom: 4 },
    barFill: (pct, color) => ({ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4 }),
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` },
    dangerBtn: { background: C.down + "10", color: C.down, border: `1px solid ${C.down}30`, borderRadius: 6, padding: "5px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: C.sans },
    confirmBox: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginTop: 12 },
  };

  return (
    <div style={MS.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={MS.modal}>
        <div style={MS.header}>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>데이터 관리</span>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: C.textDim, fontSize: 16 }} onClick={onClose}>{Icons.x}</button>
        </div>
        <div style={MS.body}>
          <div style={MS.tabs}>
            {[{ id: "overview", label: "용량 현황" }, { id: "page", label: "페이지별" }, { id: "date", label: "날짜별" }, { id: "detail", label: "세부 삭제" }, { id: "export", label: "백업" }].map((t) => (
              <button key={t.id} style={{ ...S.catBtn, ...(tab === t.id ? S.catBtnActive : {}), padding: "6px 12px" }} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {/* 용량 현황 */}
          {tab === "overview" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 32, fontWeight: 800, fontFamily: C.mono, color: Number(pct) > 80 ? C.down : Number(pct) > 60 ? "#F59E0B" : C.accent }}>{totalMB}</span>
                <span style={{ fontSize: 14, color: C.textDim, marginLeft: 4 }}>MB / 500 MB</span>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>Supabase 저장소 사용량 (추정)</div>
                <div style={{ ...MS.bar, marginTop: 10 }}>
                  <div style={MS.barFill(Number(pct), Number(pct) > 80 ? C.down : Number(pct) > 60 ? "#F59E0B" : C.accent)} />
                </div>
                <span style={{ fontSize: 11, color: C.textDim }}>{pct}% 사용 중</span>
              </div>
              {pageInfo.map((p) => (
                <div key={p.id} style={MS.row}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.label}</span>
                    <span style={{ fontSize: 10, color: C.textDim, marginLeft: 6 }}>{p.count}{p.unit}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: C.mono, color: C.textMid }}>{formatSize(p.size)}</span>
                </div>
              ))}
            </div>
          )}

          {/* 페이지별 삭제 */}
          {tab === "page" && (
            <div>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>삭제할 페이지를 선택하세요. 해당 페이지의 모든 데이터가 삭제됩니다.</p>
              {pageInfo.filter(p => p.id !== "autoData").map((p) => (
                <div key={p.id} style={{ ...MS.row, gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
                    <span style={{ fontSize: 10, color: C.textDim, display: "block" }}>{p.count}{p.unit} · {formatSize(p.size)}</span>
                  </div>
                  <button style={MS.dangerBtn} onClick={() => execAction({ type: "page", id: p.id, label: p.label })}>전체 삭제</button>
                </div>
              ))}
              <div style={{ ...MS.row, gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>빈 투자 일지</span>
                  <span style={{ fontSize: 10, color: C.textDim, display: "block" }}>내용 없는 빈 일지만 삭제</span>
                </div>
                <button style={MS.dangerBtn} onClick={() => execAction({ type: "emptyEntries" })}>빈 일지 삭제</button>
              </div>
              <div style={{ ...MS.row, gap: 10, borderTop: `2px solid ${C.down}30`, marginTop: 8, paddingTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.down }}>수집 데이터 초기화 (Supabase)</span>
                  <span style={{ fontSize: 10, color: C.textDim, display: "block" }}>수치갱신으로 DB에 쌓인 증시/지표/환율 원본 데이터를 전부 삭제합니다. 삭제 후 수치갱신을 다시 눌러야 합니다.</span>
                </div>
                <button style={{ ...MS.dangerBtn, background: C.down + "20" }} onClick={() => execAction({ type: "autoData" })}>수집 데이터 삭제</button>
              </div>
            </div>
          )}

          {/* 날짜별 삭제 */}
          {tab === "date" && (
            <div>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>기간을 선택하면 해당 기간의 데이터만 삭제됩니다.</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...S.indexInput, fontSize: 12 }} />
                <span style={{ color: C.textDim, fontSize: 12 }}>~</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...S.indexInput, fontSize: 12 }} />
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.textDim, lineHeight: "28px" }}>대상:</span>
                {[{ id: "all", label: "전체" }, { id: "entries", label: "투자 일지" }, { id: "scraps", label: "스크랩" }, { id: "reports", label: "레포트" }, { id: "indicators", label: "경제 지표" }].map((p) => (
                  <button key={p.id} style={{ ...S.catBtn, ...(selectedPage === p.id ? S.catBtnActive : {}) }} onClick={() => setSelectedPage(p.id)}>{p.label}</button>
                ))}
              </div>
              <button style={MS.dangerBtn} onClick={() => execAction({ type: "dateRange" })}>선택 기간 삭제</button>
            </div>
          )}

          {/* 세부 삭제 */}
          {tab === "detail" && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>신문 스크랩 — 카테고리별 삭제</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
                {SCRAP_CATEGORIES.map((cat) => {
                  const count = scraps.filter(s => s.category === cat.id).length;
                  if (count === 0) return null;
                  return (
                    <button key={cat.id} style={MS.dangerBtn} onClick={() => execAction({ type: "scrapCat", catId: cat.id, catLabel: cat.label })}>
                      {cat.label} ({count}개)
                    </button>
                  );
                })}
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>레포트 — 조건별 삭제</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
                {REPORT_SOURCES.map((src) => {
                  const count = reports.filter(r => r.source === src.id).length;
                  if (count === 0) return null;
                  return (
                    <button key={src.id} style={MS.dangerBtn} onClick={() => execAction({ type: "reportFilter", filterType: "source", filterValue: src.id })}>
                      {src.label} ({count}개)
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                <button style={MS.dangerBtn} onClick={() => execAction({ type: "reportFilter", filterType: "rating", filterValue: 2 })}>평점 1~2점 레포트 삭제</button>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.text }}>경제 지표 — 개별 삭제</p>
              <div style={{ maxHeight: 200, overflow: "auto" }}>
                {ALL_ITEMS.filter(item => indicators[item.id]?.length > 0).map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 11 }}>{item.name} ({indicators[item.id]?.length || 0}건)</span>
                    <button style={{ ...MS.dangerBtn, padding: "3px 8px", fontSize: 9 }} onClick={() => execAction({ type: "indicatorId", indId: item.id, indName: item.name })}>삭제</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 백업 */}
          {tab === "export" && (
            <div>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>데이터를 JSON 파일로 다운로드합니다. 삭제 전에 백업해두세요.</p>
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <button style={{ ...S.scrapAddBtn, maxWidth: 300, margin: "0 auto" }} onClick={exportData}>
                  {Icons.save} 전체 데이터 백업 다운로드
                </button>
                <p style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>invest-note-backup-{toKey(new Date())}.json ({formatSize(sizes.total)})</p>
              </div>
            </div>
          )}

          {/* 삭제 확인 */}
          {pendingAction && (
            <div style={MS.confirmBox}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.down, margin: "0 0 8px" }}>⚠️ 정말 삭제하시겠습니까?</p>
              <p style={{ fontSize: 11, color: C.textMid, margin: "0 0 10px" }}>이 작업은 되돌릴 수 없습니다. 확인하려면 아래에 <strong>"삭제"</strong>를 입력하세요.</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...S.indexInput, fontSize: 12 }} placeholder='"삭제" 입력' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmAction()} />
                <button style={{ ...MS.dangerBtn, opacity: confirmText === "삭제" ? 1 : 0.4 }} onClick={confirmAction} disabled={confirmText !== "삭제"}>확인</button>
                <button style={S.addChip} onClick={() => setPendingAction(null)}>취소</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ STYLES ═══ */
const C = {
  bg: "#F7F8FA", surface: "#FFFFFF", card: "#FFFFFF", border: "#E2E4E9", borderLight: "#C8CCD4",
  text: "#1A1D23", textMid: "#4E5461", textDim: "#8B919E",
  accent: "#2563EB", accentDim: "rgba(37,99,235,0.06)", accentGlow: "rgba(37,99,235,0.12)",
  up: "#16A34A", upBg: "rgba(22,163,74,0.06)", down: "#DC2626", downBg: "rgba(220,38,38,0.06)",
  mono: "'JetBrains Mono', monospace", sans: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
};
const S = {
  root: { fontFamily: C.sans, background: C.bg, color: C.text, minHeight: "100vh", maxWidth: 780, margin: "0 auto", padding: "0 20px 40px", position: "relative", WebkitFontSmoothing: "antialiased" },
  loadWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: C.sans, background: C.bg, color: C.textMid, gap: 16 },
  loadSpin: { width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadText: { fontSize: 13, color: C.textDim },
  toast: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#1A1D23", color: "#fff", padding: "10px 20px", borderRadius: 6, fontSize: 12, fontWeight: 500, zIndex: 999, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", letterSpacing: -0.2 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 12px", borderBottom: `1px solid ${C.border}` },
  headerLeft: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  logoMark: { width: 32, height: 32, borderRadius: 6, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: -0.5, flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: -0.5, color: C.text },
  subtitle: { fontSize: 9, color: C.textDim, margin: 0, fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" },
  headerActions: { display: "flex", alignItems: "center", gap: 6 },
  saveBtn: { display: "flex", alignItems: "center", gap: 5, background: C.accent, color: "#fff", border: "none", borderRadius: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: C.sans },
  logoutBtn: { background: "none", border: `1px solid ${C.border}`, borderRadius: 5, color: C.textDim, padding: "6px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: C.sans },
  viewToggleBar: { display: "flex", gap: 3, padding: "10px 0 6px", borderBottom: `1px solid ${C.border}` },
  viewToggleBtn: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid transparent", color: C.textDim, padding: "6px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", borderRadius: 5, fontFamily: C.sans },
  viewToggleBtnActive: { background: C.accentDim, color: C.accent, borderColor: C.accentGlow },
  dateBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 8px" },
  dateArrow: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMid, padding: 6, cursor: "pointer", display: "flex", alignItems: "center" },
  dateCenter: { display: "flex", alignItems: "center", gap: 8, color: C.text, cursor: "pointer", position: "relative" },
  dateText: { fontSize: 15, fontWeight: 600, letterSpacing: -0.3 },
  todayBadge: { background: C.accentDim, color: C.accent, fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3 },
  quickActions: { display: "flex", gap: 6, padding: "4px 0 10px", flexWrap: "wrap" },
  quickBtn: { display: "flex", alignItems: "center", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, color: C.textMid, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: C.sans, fontWeight: 500 },
  tabs: { display: "flex", gap: 1, padding: "4px 0 12px", borderBottom: `1px solid ${C.border}`, overflowX: "auto", msOverflowStyle: "none", scrollbarWidth: "none" },
  tab: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: C.textDim, padding: "7px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", borderRadius: 5, fontFamily: C.sans, whiteSpace: "nowrap", flexShrink: 0 },
  tabActive: { background: C.accentDim, color: C.accent, fontWeight: 600 },
  main: { padding: "12px 0" },
  sectionWrap: { display: "flex", flexDirection: "column", gap: 8 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, display: "flex", flexDirection: "column", gap: 10 },
  cardHeader: { display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` },
  flag: { fontSize: 17 },
  cardTitle: { fontSize: 13, fontWeight: 600, letterSpacing: -0.2 },
  sectionNum: { fontSize: 11, fontWeight: 600, color: C.accent, fontFamily: C.mono, minWidth: 22 },
  cardTitleInput: { flex: 1, background: "none", border: "none", color: C.text, fontSize: 13, fontWeight: 600, fontFamily: C.sans, outline: "none", letterSpacing: -0.2, minWidth: 0 },
  changeBadge: { fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 3, fontFamily: C.mono, color: C.textMid, background: C.bg },
  changeUp: { color: C.up, background: C.upBg },
  changeDown: { color: C.down, background: C.downBg },
  changeBadgeSm: { fontSize: 10, fontWeight: 600, padding: "2px 5px", borderRadius: 3, fontFamily: C.mono, color: C.textMid, background: C.bg, whiteSpace: "nowrap" },
  indexRow: { display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" },
  indexLabel: { fontSize: 12, fontWeight: 600, color: C.text, minWidth: 70, flexShrink: 0 },
  indexInput: { flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "6px 8px", fontSize: 11, fontFamily: C.mono, outline: "none", minWidth: 60, boxSizing: "border-box" },
  indexRemoveBtn: { background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 2, display: "flex", alignItems: "center", opacity: 0.4, flexShrink: 0 },
  addChip: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textMid, padding: "3px 8px", fontSize: 10, fontWeight: 500, cursor: "pointer", fontFamily: C.sans, whiteSpace: "nowrap" },
  removeBtn: { background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4, display: "flex", opacity: 0.5 },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 3 },
  fieldLabel: { fontSize: 10, fontWeight: 600, color: C.textDim, letterSpacing: 0.3 },
  input: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "8px 10px", fontSize: 13, fontFamily: C.sans, outline: "none" },
  inputSmall: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "7px 10px", fontSize: 12, fontFamily: C.sans, outline: "none", width: "100%", boxSizing: "border-box" },
  textarea: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "8px 10px", fontSize: 12, fontFamily: C.sans, outline: "none", resize: "vertical", lineHeight: 1.6, width: "100%", boxSizing: "border-box" },
  addBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: C.surface, border: `1px dashed ${C.borderLight}`, borderRadius: 6, color: C.textMid, padding: "11px 0", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: C.sans },
  memoSection: { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 },
  memoLabel: { fontSize: 13, fontWeight: 600, letterSpacing: -0.2 },
  memoArea: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, padding: "10px 12px", fontSize: 12, fontFamily: C.sans, outline: "none", resize: "vertical", lineHeight: 1.7, width: "100%", boxSizing: "border-box" },
  footer: { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 0 8px", fontSize: 10, color: C.textDim },
  footerDot: { width: 3, height: 3, borderRadius: "50%", background: C.textDim },
  streakBar: { display: "flex", justifyContent: "space-between", padding: "12px 16px", background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, margin: "10px 0" },
  streakDay: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flex: 1 },
  streakLabel: { fontSize: 10, fontWeight: 600 },
  streakDot: { width: 10, height: 10, borderRadius: "50%" },
  streakDate: { fontSize: 11, fontWeight: 500 },
  weekCard: { display: "flex", alignItems: "center", gap: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", cursor: "pointer" },
  weekCardLeft: { display: "flex", alignItems: "center", gap: 6, minWidth: 80 },
  weekCardDay: { fontSize: 13, fontWeight: 600, minWidth: 18 },
  weekCardDate: { fontSize: 12, color: C.textMid, fontFamily: C.mono, fontWeight: 500 },
  weekCardRight: { flex: 1 },
  weekCardStats: { display: "flex", gap: 4, flexWrap: "wrap" },
  weekStatPill: { display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: C.textMid, background: C.bg, padding: "2px 6px", borderRadius: 3, fontWeight: 500 },
  miniPill: { fontSize: 10, padding: "2px 6px", borderRadius: 3, fontWeight: 600, fontFamily: C.mono },
  monthStatsBar: { display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: C.card, borderRadius: 6, border: `1px solid ${C.border}`, margin: "10px 0", flexWrap: "wrap" },
  monthStatItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  monthStatNum: { fontSize: 18, fontWeight: 700, fontFamily: C.mono, color: C.text },
  monthStatLabel: { fontSize: 10, color: C.textDim, fontWeight: 500 },
  monthStatDivider: { width: 1, height: 28, background: C.border },
  monthProgressOuter: { flex: 1, minWidth: 60, maxWidth: 140, height: 5, background: C.border, borderRadius: 3, overflow: "hidden" },
  monthProgressInner: { height: "100%", background: C.accent, borderRadius: 3, transition: "width 0.3s ease" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginTop: 8 },
  calHeader: { textAlign: "center", fontSize: 10, fontWeight: 600, color: C.textDim, padding: "6px 0" },
  calCell: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 3px", minHeight: 48, cursor: "pointer", transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 2, alignItems: "center" },
  calDayNum: { fontSize: 12, fontWeight: 400, textAlign: "center" },
  calDotRow: { display: "flex", justifyContent: "center", gap: 2 },
  calIntensity: { width: 16, height: 3, borderRadius: 2 },
  calMemoSnip: { fontSize: 7, color: C.textDim, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2, maxWidth: "100%", padding: "0 1px" },
  hiddenDateInput: { position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" },

  pageToggleBar: { display: "flex", gap: 0, padding: "10px 0 0", borderBottom: `2px solid ${C.border}`, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" },
  pageToggleBtn: { display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", borderBottom: "2px solid transparent", color: C.textDim, padding: "9px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: C.sans, transition: "all 0.15s", marginBottom: -2, whiteSpace: "nowrap", flexShrink: 0 },
  pageToggleBtnActive: { color: C.accent, borderBottomColor: C.accent, fontWeight: 700 },
  scrapCount: { background: C.accent, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4, marginLeft: 2 },

  searchBar: { position: "relative", marginTop: 12, marginBottom: 8 },
  searchIcon: { position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.textDim, display: "flex" },
  searchInput: { width: "100%", boxSizing: "border-box", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.text, padding: "9px 34px 9px 36px", fontSize: 12, fontFamily: C.sans, outline: "none" },
  searchClear: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.textDim, cursor: "pointer", display: "flex", padding: 4 },

  catFilter: { display: "flex", gap: 3, overflowX: "auto", padding: "3px 0 10px", scrollbarWidth: "none", msOverflowStyle: "none" },
  catBtn: { display: "flex", alignItems: "center", gap: 3, background: "none", border: `1px solid ${C.border}`, color: C.textDim, padding: "5px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", borderRadius: 4, fontFamily: C.sans, whiteSpace: "nowrap", flexShrink: 0 },
  catBtnActive: { background: C.accentDim, color: C.accent, borderColor: C.accentGlow },
  catBtnCount: { fontSize: 9, fontWeight: 700, opacity: 0.7 },

  scrapAddBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 5, width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 5, padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: C.sans, marginBottom: 4 },

  scrapForm: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14, marginTop: 8 },
  catSelectGrid: { display: "flex", flexWrap: "wrap", gap: 5 },
  catSelectBtn: { background: C.bg, border: "1px solid " + C.border, borderRadius: 4, color: C.textMid, padding: "5px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: C.sans },
  formSaveBtn: { flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 5, padding: "9px 0", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: C.sans },
  formCancelBtn: { background: C.bg, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 5, padding: "9px 18px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: C.sans },

  scrapCard: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 },
  scrapCatBadge: { fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 3 },
  scrapTitle: { fontSize: 14, fontWeight: 600, margin: 0, color: C.text, lineHeight: 1.5, letterSpacing: -0.2 },
  scrapLink: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.accent, textDecoration: "none", marginTop: 5, wordBreak: "break-all" },
  scrapSummary: { fontSize: 12, color: C.textMid, lineHeight: 1.7, margin: "6px 0 0", whiteSpace: "pre-wrap" },
  scrapMemo: { fontSize: 12, color: C.text, lineHeight: 1.6, margin: "6px 0 0", background: C.accentDim, borderRadius: 4, padding: "8px 10px" },
  scrapTag: { fontSize: 10, color: C.accent, fontWeight: 500 },
  scrapActionBtn: { background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 3, display: "flex", opacity: 0.6 },

  /* Dashboard — styles moved inline to component */

  tblSection: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 8, overflow: "hidden",  },
  tblSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: -0.3, userSelect: "none" },
  tblBody: { borderTop: `1px solid ${C.border}` },
  tblRow: { display: "flex", alignItems: "center", gap: 4, padding: "7px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 11, flexWrap: "wrap" },
  pinBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0, width: 18, textAlign: "center" },
  tblName: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: C.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", letterSpacing: -0.2 },
  tblVal: { fontSize: 11, fontWeight: 700, fontFamily: C.mono, color: C.text, minWidth: 50, textAlign: "right", flexShrink: 0 },
  tblDiff: { fontSize: 10, fontWeight: 600, fontFamily: C.mono, minWidth: 36, textAlign: "right", flexShrink: 0, color: C.textDim },
  tblDate: { fontSize: 9, color: C.textDim, minWidth: 30, textAlign: "right", flexShrink: 0, fontFamily: C.mono },
  tblBtn: { background: "none", border: `1px solid ${C.border}`, borderRadius: 3, color: C.textMid, padding: "2px 3px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 },
  tblEditRow: { display: "flex", gap: 5, padding: "5px 12px 8px 36px", alignItems: "center", background: C.bg, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" },
  tblDetail: { padding: "8px 12px 8px 36px", background: C.bg, borderBottom: `1px solid ${C.border}` },
  tblHistRow: { display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: `1px solid ${C.border}` },
  indBtn: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.textMid, padding: "4px 5px", cursor: "pointer", display: "flex", alignItems: "center" },
};
