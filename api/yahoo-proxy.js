export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbols, search } = req.query;

  // Search mode — 종목 검색 자동완성
  if (search) {
    try {
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=false`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        }
      });
      if (!r.ok) {
        const r2 = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!r2.ok) return res.status(502).json({ error: "Yahoo search failed", quotes: [] });
        const data2 = await r2.json();
        return res.status(200).json({ quotes: (data2.quotes || []).filter(q => q.symbol).slice(0, 8) });
      }
      const data = await r.json();
      return res.status(200).json({ quotes: (data.quotes || []).filter(q => q.symbol).slice(0, 8) });
    } catch (e) {
      return res.status(500).json({ error: e.message, quotes: [] });
    }
  }

  // Quote mode — 주가 조회
  if (!symbols) return res.status(400).json({ error: "symbols or search required" });

  const symbolList = symbols.split(",").slice(0, 20);
  const results = {};

  for (let i = 0; i < symbolList.length; i += 5) {
    const batch = symbolList.slice(i, i + 5);
    await Promise.all(batch.map(async (symbol) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!r.ok) return;
        const data = await r.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice) {
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          const vol = meta.regularMarketVolume || 0;
          const chg = prev ? (((price - prev) / prev) * 100).toFixed(2) : null;
          results[symbol] = {
            name: meta.shortName || meta.longName || symbol,
            price: price.toFixed(2),
            change: chg ? (chg > 0 ? `+${chg}%` : `${chg}%`) : null,
            volume: vol,
            tradingValue: price * vol,
            currency: meta.currency || "",
          };
        }
      } catch (e) {}
    }));
  }
  return res.status(200).json(results);
}
