/**
 * TWSE ETF Data Proxy Worker for Cloudflare
 *
 * Proxies requests to Taiwan Stock Exchange OpenAPI for ETF data.
 * Combines price (AVG+DAY), yield/PE, and fund info into a unified response.
 * Caches for 1 hour (market data updates daily after market close).
 *
 * Endpoints:
 *   GET /etf-list  — All ETFs with price, yield, PE, name
 *   GET /health    — Health check
 */

const TWSE_AVG_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL';
const TWSE_DAY_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
const TWSE_YIELD_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';
const TWSE_FUND_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap47_L';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Fetch and merge ETF data from TWSE (3 APIs + fund info)
 */
async function fetchEtfData() {
  const [avgRes, dayRes, yieldRes, fundRes] = await Promise.all([
    fetch(TWSE_AVG_URL),
    fetch(TWSE_DAY_URL),
    fetch(TWSE_YIELD_URL),
    fetch(TWSE_FUND_URL),
  ]);

  if (!avgRes.ok) throw new Error(`Avg API: ${avgRes.status}`);
  const avgData = await avgRes.json();

  // STOCK_DAY_ALL — OHLCV per stock
  let dayMap = {};
  if (dayRes.ok) {
    try {
      const dayData = await dayRes.json();
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
    } catch (e) {
      // Day data optional
    }
  }

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

  // Fund basic info (ETF-specific)
  let fundMap = {};
  if (fundRes.ok) {
    try {
      const fundData = await fundRes.json();
      for (const item of fundData) {
        // Match by stock code field
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

  // Filter to ETFs (codes starting with 00) and merge all sources
  const etfs = avgData
    .filter(d => d.Code && d.Code.startsWith('00'))
    .map(d => {
      const y = yieldMap[d.Code] || {};
      const day = dayMap[d.Code] || {};
      const fund = fundMap[d.Code] || {};
      const price = parseFloat(d.ClosingPrice) || 0;
      const shares = parseFloat(fund.sharesOutstanding) || 0;

      return {
        code: d.Code,
        name: d.Name,
        price: d.ClosingPrice || '',
        monthAvg: d.MonthlyAveragePrice || '',
        yield: y.yield || '',
        pe: y.pe || '',
        pb: y.pb || '',
        date: d.Date || '',
        // STOCK_DAY_ALL fields
        open: day.open || '',
        high: day.high || '',
        low: day.low || '',
        volume: day.volume || '',
        change: day.change || '',
        transactions: day.transactions || '',
        // Fund info fields
        englishName: fund.englishName || '',
        benchmarkIndex: fund.benchmarkIndex || '',
        inceptionDate: fund.inceptionDate || '',
        sharesOutstanding: fund.sharesOutstanding || '',
        fundManager: fund.fundManager || '',
        // Computed: AUM = shares × price
        aum: (shares && price) ? Math.round(shares * price) : '',
      };
    });

  return {
    count: etfs.length,
    date: etfs[0]?.date || '',
    fetchedAt: new Date().toISOString(),
    etfs,
  };
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'TWSE ETF Proxy',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/etf-list') {
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

    try {
      const data = await fetchEtfData();
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
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Fetch error', message: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found', message: 'Use /etf-list' }), {
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
