/**
 * CPC Oil Price Proxy Worker for Cloudflare
 *
 * Proxies requests to Taiwan CPC (中油) oil price endpoint with CORS headers.
 * Caches response for 1 hour since prices change weekly.
 *
 * Deploy: Same as workers/tdx-proxy.js — see workers/DEPLOY.md
 */

const CPC_OIL_URL = 'https://www.cpc.com.tw/GetOilPriceJson.aspx';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Parse CPC JSON response into a normalized format
 */
function parseCpcResponse(data) {
  // CPC returns an array of price objects
  // Normalize into our standard format
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = d => d.toISOString().slice(0, 10);

  // Try to extract prices from CPC response
  const products = [];
  const mapping = {
    '92': { name: '92 Unleaded', nameZh: '92無鉛汽油' },
    '95': { name: '95 Unleaded', nameZh: '95無鉛汽油' },
    '98': { name: '98 Unleaded', nameZh: '98無鉛汽油' },
    'diesel': { name: 'Diesel', nameZh: '超級柴油' },
  };

  if (Array.isArray(data)) {
    for (const item of data) {
      const prodName = item.ProdName || '';
      let key = null;
      if (prodName.includes('92')) key = '92';
      else if (prodName.includes('95')) key = '95';
      else if (prodName.includes('98')) key = '98';
      else if (prodName.includes('柴油') || prodName.toLowerCase().includes('diesel')) key = 'diesel';

      if (key && mapping[key]) {
        products.push({
          ...mapping[key],
          key,
          price: parseFloat(item.ProdPrice) || 0,
          unit: 'NT$/L'
        });
      }
    }
  }

  return {
    date: fmt(weekStart),
    dateEnd: fmt(weekEnd),
    products,
    predict: [], // CPC doesn't provide predictions in the same endpoint
    history: [],
    source: 'CPC',
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Handle incoming requests
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'CPC Oil Price Proxy',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Oil price endpoint
  if (path === '/oil-price') {
    const cacheTtl = 3600; // 1 hour

    // Check Cloudflare Cache API first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      headers.set('X-Cache', 'HIT');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }

    try {
      const response = await fetch(CPC_OIL_URL, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`CPC API returned ${response.status}`);
      }

      const rawData = await response.json();
      const parsed = parseCpcResponse(rawData);
      const body = JSON.stringify(parsed);

      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${cacheTtl}`,
        'X-Cache': 'MISS',
      };

      const result = new Response(body, { headers: responseHeaders });

      // Store in edge cache
      const cacheResponse = new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${cacheTtl}`,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResponse));

      return result;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Fetch error',
        message: error.message,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // 404 for unknown paths
  return new Response(JSON.stringify({
    error: 'Not found',
    message: 'Use /oil-price to get current prices',
  }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Main entry point
 */
export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    return handleRequest(request, env, ctx);
  },
};
