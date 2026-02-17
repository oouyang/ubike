/**
 * TWSE ETF Data Proxy Worker for Cloudflare
 *
 * Proxies requests to Taiwan Stock Exchange OpenAPI for ETF data.
 * Combines price data with yield/PE data into a unified response.
 * Caches for 1 hour (market data updates daily after market close).
 *
 * Endpoints:
 *   GET /etf-list  — All ETFs with price, yield, PE, name
 *   GET /health    — Health check
 */

const TWSE_PRICE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL';
const TWSE_YIELD_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Fetch and merge ETF data from TWSE
 */
async function fetchEtfData() {
  const [priceRes, yieldRes] = await Promise.all([
    fetch(TWSE_PRICE_URL),
    fetch(TWSE_YIELD_URL),
  ]);

  if (!priceRes.ok) throw new Error(`Price API: ${priceRes.status}`);
  const priceData = await priceRes.json();

  // Yield data may not include ETFs, but try anyway
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

  // Filter to ETFs (codes starting with 00)
  const etfs = priceData
    .filter(d => d.Code && d.Code.startsWith('00'))
    .map(d => {
      const y = yieldMap[d.Code] || {};
      return {
        code: d.Code,
        name: d.Name,
        price: d.ClosingPrice || '',
        monthAvg: d.MonthlyAveragePrice || '',
        yield: y.yield || '',
        pe: y.pe || '',
        pb: y.pb || '',
        date: d.Date || '',
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
