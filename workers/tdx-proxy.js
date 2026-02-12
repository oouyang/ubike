/**
 * TDX API Proxy Worker for Cloudflare
 *
 * This worker securely proxies requests to Taiwan's TDX (Transport Data eXchange) API
 * while keeping your API credentials safe on the server side.
 *
 * Deploy: See workers/DEPLOY.md for step-by-step instructions
 */

// Token cache (in-memory, per worker instance)
let cachedToken = null;
let tokenExpiry = 0;

// TDX API endpoints
const TDX_AUTH_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const TDX_API_BASE = 'https://tdx.transportdata.tw/api/basic';

/**
 * Determine cache TTL (in seconds) based on the API endpoint.
 * Static data (routes, stops) → long cache. Real-time data (arrivals) → short cache.
 */
function getCacheTtl(path) {
  const p = path.toLowerCase();

  // Real-time: arrivals, delays, live position → 30 seconds
  if (p.includes('estimatedtimeofarrival') ||
      p.includes('realtimebyfrequency') ||
      p.includes('realtimenearstop') ||
      p.includes('livetraindelay') ||
      p.includes('liveposition')) {
    return 30;
  }

  // Semi-static: timetables, schedules → 6 hours
  if (p.includes('generaltimetable') ||
      p.includes('dailytimetable') ||
      p.includes('schedule')) {
    return 6 * 3600;
  }

  // Static: routes, stops, stations, fare → 24 hours
  if (p.includes('route') ||
      p.includes('stop') ||
      p.includes('station') ||
      p.includes('fare') ||
      p.includes('shape') ||
      p.includes('displaystopofroute') ||
      p.includes('stopofroute')) {
    return 24 * 3600;
  }

  // Default: 5 minutes for unknown endpoints
  return 300;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Get TDX access token (with caching)
 */
async function getAccessToken(env) {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = env.TDX_CLIENT_ID;
  const clientSecret = env.TDX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TDX credentials not configured. Set TDX_CLIENT_ID and TDX_CLIENT_SECRET in Worker environment variables.');
  }

  const response = await fetch(TDX_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`TDX auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Cache token for slightly less than its expiry time
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
}

/**
 * Handle incoming requests
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check endpoint
  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'TDX Proxy',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // API info endpoint
  if (path === '/api') {
    return new Response(JSON.stringify({
      endpoints: [
        'GET /v2/Bus/Stop/City/{City}',
        'GET /v2/Bus/EstimatedTimeOfArrival/City/{City}',
        'GET /v2/Bus/Route/City/{City}',
        'GET /v2/Bus/RealTimeByFrequency/City/{City}',
        'GET /v2/Bus/Stop/InterCity',
        'GET /v2/Bus/EstimatedTimeOfArrival/InterCity',
      ],
      usage: 'Append TDX API path to this worker URL',
      example: '/v2/Bus/Stop/City/Taipei?$top=10',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Proxy TDX API requests
  if (path.startsWith('/v2/')) {
    try {
      // Determine cache TTL based on endpoint type
      const cacheTtl = getCacheTtl(path);

      // Check Cloudflare Cache API first
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), { method: 'GET' });

      if (cacheTtl > 0) {
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          // Clone and add CORS headers (cached response may not have them)
          const headers = new Headers(cachedResponse.headers);
          Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
          headers.set('X-Cache', 'HIT');
          return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers,
          });
        }
      }

      const token = await getAccessToken(env);

      // Build TDX API URL
      const tdxUrl = TDX_API_BASE + path + url.search;

      const response = await fetch(tdxUrl, {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(JSON.stringify({
          error: 'TDX API error',
          status: response.status,
          message: error,
        }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const body = JSON.stringify(data);

      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${cacheTtl}`,
        'X-Cache': 'MISS',
      };

      const result = new Response(body, { headers: responseHeaders });

      // Store in Cloudflare edge cache (non-blocking)
      if (cacheTtl > 0) {
        const cacheResponse = new Response(body, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${cacheTtl}`,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, cacheResponse));
      }

      return result;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Proxy error',
        message: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // 404 for unknown paths
  return new Response(JSON.stringify({
    error: 'Not found',
    message: 'Use /v2/... to proxy TDX API requests',
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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    return handleRequest(request, env, ctx);
  },
};
