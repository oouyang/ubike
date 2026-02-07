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
async function handleRequest(request, env) {
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

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30', // Cache for 30 seconds
        },
      });
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

    return handleRequest(request, env);
  },
};
