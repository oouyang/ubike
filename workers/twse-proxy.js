/**
 * TWSE Data Proxy Worker for Cloudflare
 *
 * Unified proxy for Taiwan Stock Exchange OpenAPI data.
 * Serves both ETF and individual stock data from shared upstream fetches.
 * Caches each endpoint for 1 hour (market data updates daily after close).
 *
 * Note: OTC-listed ETFs (bond ETFs ending in B like 00679B, 00937B) are not
 * available from TWSE APIs. TPEX (tpex.org.tw) blocks Cloudflare Workers
 * directly, so OTC data is fetched via an external FastAPI proxy.
 *
 * Endpoints:
 *   GET /etf-list    — All ETFs with price, yield, PE, fund info
 *   GET /stock-list  — All stocks (non-ETF) with price, OHLCV, PE, yield, PB
 *   GET /taifex/futures — TAIFEX daily futures report (proxied for CORS)
 *   GET /taifex/options — TAIFEX daily options report (proxied for CORS)
 *   GET /health      — Health check
 */

const TWSE_AVG_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL';
const TWSE_DAY_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TWSE_YIELD_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';
const TWSE_FUND_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap47_L';
const TPEX_PROXY_URL = 'https://m.taleon.work.gd/tpex/etf-list';

const TAIFEX_BASE = 'https://openapi.taifex.com.tw/v1';
const TAIFEX_ENDPOINTS = {
  '/taifex/futures': `${TAIFEX_BASE}/DailyMarketReportFut`,
  '/taifex/options': `${TAIFEX_BASE}/DailyMarketReportOpt`,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Fetch shared upstream data (DAY + YIELD) used by both endpoints.
 * ETF endpoint additionally needs AVG + FUND.
 */
async function fetchAllData(includeEtfExtras) {
  const fetches = [fetch(TWSE_DAY_URL), fetch(TWSE_YIELD_URL)];
  if (includeEtfExtras) {
    fetches.push(fetch(TWSE_AVG_URL), fetch(TWSE_FUND_URL));
  }

  const results = await Promise.all(fetches);
  const [dayRes, yieldRes] = results;

  if (!dayRes.ok) throw new Error(`Day API: ${dayRes.status}`);
  const dayData = await dayRes.json();

  // Yield/PE data
  let yieldMap = {};
  if (yieldRes.ok) {
    try {
      const yieldData = await yieldRes.json();
      for (const item of yieldData) {
        yieldMap[item.Code] = {
          pe: item.PEratio || '',
          yield: item.DividendYield || '',
          pb: item.PBratio || '',
        };
      }
    } catch (e) {
      // Yield data optional
    }
  }

  let avgData = null;
  let fundMap = {};

  if (includeEtfExtras) {
    const [, , avgRes, fundRes] = results;

    if (avgRes.ok) {
      try { avgData = await avgRes.json(); } catch (e) { /* optional */ }
    }

    if (fundRes.ok) {
      try {
        const fundData = await fundRes.json();
        for (const item of fundData) {
          const code = item['基金代號'] || item['證券代號'] || '';
          if (!code) continue;
          fundMap[code] = {
            englishName: item['英文名稱'] || '',
            benchmarkIndex: item['標的指數'] || item['追蹤指數名稱'] || '',
            inceptionDate: item['成立日期'] || '',
            sharesOutstanding: item['發行單位數'] || item['轉換數'] || '',
            fundManager: item['投資經理人'] || item['經理人'] || '',
          };
        }
      } catch (e) {
        // Fund data optional
      }
    }
  }

  return { dayData, yieldMap, avgData, fundMap };
}

/**
 * Fetch OTC-listed ETFs from TPEX via external proxy.
 * Returns array of ETF objects or empty array on failure.
 */
async function fetchOtcEtfs() {
  try {
    const res = await fetch(TPEX_PROXY_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return data.etfs || [];
  } catch (e) {
    return [];
  }
}

/**
 * Build ETF list from fetched data
 */
function buildEtfList({ dayData, yieldMap, avgData, fundMap, otcEtfs }) {
  // Build day map for OHLCV
  const dayMap = {};
  for (const item of dayData) {
    dayMap[item.Code] = {
      open: item.OpeningPrice || '',
      high: item.HighestPrice || '',
      low: item.LowestPrice || '',
      volume: item.TradeVolume || '',
      change: item.Change || '',
      transactions: item.Transaction || '',
    };
  }

  // Build AVG map for MonthlyAveragePrice lookup
  const avgMap = {};
  if (avgData) {
    for (const item of avgData) {
      avgMap[item.Code] = item;
    }
  }

  // Union AVG and DAY sources so ETFs in either API are included
  const seen = new Set();
  const combined = [];
  for (const source of [avgData || [], dayData]) {
    for (const d of source) {
      if (d.Code && d.Code.startsWith('00') && !seen.has(d.Code)) {
        seen.add(d.Code);
        combined.push(d);
      }
    }
  }

  const etfs = combined.map(d => {
      const y = yieldMap[d.Code] || {};
      const day = dayMap[d.Code] || {};
      const avg = avgMap[d.Code] || {};
      const fund = fundMap[d.Code] || {};
      const price = parseFloat(d.ClosingPrice) || 0;
      const shares = parseFloat(fund.sharesOutstanding) || 0;

      return {
        code: d.Code,
        name: d.Name,
        price: d.ClosingPrice || '',
        monthAvg: avg.MonthlyAveragePrice || d.MonthlyAveragePrice || '',
        yield: y.yield || '',
        pe: y.pe || '',
        pb: y.pb || '',
        date: d.Date || '',
        open: day.open || '',
        high: day.high || '',
        low: day.low || '',
        volume: day.volume || '',
        change: day.change || '',
        transactions: day.transactions || '',
        englishName: fund.englishName || '',
        benchmarkIndex: fund.benchmarkIndex || '',
        inceptionDate: fund.inceptionDate || '',
        sharesOutstanding: fund.sharesOutstanding || '',
        fundManager: fund.fundManager || '',
        aum: (shares && price) ? Math.round(shares * price) : '',
      };
    });

  // Append OTC ETFs from TPEX proxy
  if (otcEtfs && otcEtfs.length) {
    for (const otc of otcEtfs) {
      if (!seen.has(otc.code)) {
        seen.add(otc.code);
        etfs.push(otc);
      }
    }
  }

  return {
    count: etfs.length,
    date: etfs[0]?.date || '',
    fetchedAt: new Date().toISOString(),
    etfs,
  };
}

/**
 * Build stock list from fetched data (excludes ETFs)
 */
function buildStockList({ dayData, yieldMap }) {
  const stocks = dayData
    .filter(d => d.Code && !d.Code.startsWith('00'))
    .map(d => {
      const y = yieldMap[d.Code] || {};
      return {
        code: d.Code,
        name: d.Name,
        price: d.ClosingPrice || '',
        open: d.OpeningPrice || '',
        high: d.HighestPrice || '',
        low: d.LowestPrice || '',
        volume: d.TradeVolume || '',
        change: d.Change || '',
        transactions: d.Transaction || '',
        monthAvg: d.MonthlyAveragePrice || '',
        pe: y.pe || '',
        yield: y.yield || '',
        pb: y.pb || '',
        date: d.Date || '',
      };
    });

  return {
    count: stocks.length,
    date: stocks[0]?.date || '',
    fetchedAt: new Date().toISOString(),
    stocks,
  };
}

/**
 * Shared cache-then-fetch handler
 */
async function cachedFetch(url, ctx, fetchFn) {
  const cacheTtl = 3600;
  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const headers = new Headers(cachedResponse.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    headers.set('X-Cache', 'HIT');
    return new Response(cachedResponse.body, { status: cachedResponse.status, headers });
  }

  const data = await fetchFn();
  const body = JSON.stringify(data);
  const responseHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': `public, max-age=${cacheTtl}`,
    'X-Cache': 'MISS',
  };

  const result = new Response(body, { headers: responseHeaders });
  const cacheResponse = new Response(body, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${cacheTtl}` },
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResponse));
  return result;
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'TWSE Proxy',
      endpoints: ['/etf-list', '/stock-list', '/taifex/futures', '/taifex/options', '/health'],
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/etf-list') {
    try {
      return await cachedFetch(url, ctx, async () => {
        const [raw, otcEtfs] = await Promise.all([
          fetchAllData(true),
          fetchOtcEtfs(),
        ]);
        return buildEtfList({ ...raw, otcEtfs });
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Fetch error', message: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (path === '/stock-list') {
    try {
      return await cachedFetch(url, ctx, async () => {
        const raw = await fetchAllData(false);
        return buildStockList(raw);
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Fetch error', message: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // TAIFEX proxy routes
  const taifexUpstream = TAIFEX_ENDPOINTS[path];
  if (taifexUpstream) {
    try {
      return await cachedFetch(url, ctx, async () => {
        const res = await fetch(taifexUpstream, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) throw new Error(`TAIFEX returned ${res.status}`);
        return await res.json();
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Fetch error', message: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found', message: 'Use /etf-list, /stock-list, /taifex/futures, or /taifex/options' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    return handleRequest(request, env, ctx);
  },
};
