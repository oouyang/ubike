/**
 * TAIFEX Proxy Worker for Cloudflare
 *
 * Proxies TAIFEX OpenAPI endpoints to add CORS headers.
 * The TAIFEX API is open (no auth) but lacks CORS headers,
 * blocking client-side fetch from GitHub Pages.
 *
 * Routes:
 *   GET /futures  → DailyMarketReportFut
 *   GET /options  → DailyMarketReportOpt
 *   GET /health   → Health check
 *
 * Caches responses for 10 minutes since data updates daily.
 *
 * Deploy: Same as workers/tdx-proxy.js — see workers/DEPLOY.md
 */

const TAIFEX_BASE = 'https://openapi.taifex.com.tw/v1';

const ENDPOINTS = {
  '/futures': `${TAIFEX_BASE}/DailyMarketReportFut`,
  '/options': `${TAIFEX_BASE}/DailyMarketReportOpt`,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'TAIFEX Proxy',
      endpoints: ['/futures', '/options'],
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const upstream = ENDPOINTS[path];
  if (!upstream) {
    return new Response(JSON.stringify({
      error: 'Not found',
      message: 'Use /futures or /options',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cacheTtl = 600; // 10 minutes
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
    const response = await fetch(upstream, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`TAIFEX returned ${response.status}`);
    }

    const body = await response.text();

    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${cacheTtl}`,
      'X-Cache': 'MISS',
    };

    const result = new Response(body, { headers: responseHeaders });
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

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    return handleRequest(request, env, ctx);
  },
};
