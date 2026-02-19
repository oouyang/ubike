/**
 * CPC Oil Price Proxy Worker for Cloudflare
 *
 * Scrapes CPC (中油) historical price page HTML to extract real prices.
 * The JSON API requires browser sessions, but the HTML page works server-side.
 * Caches response for 1 hour since prices change weekly.
 *
 * Deploy: Same as workers/tdx-proxy.js — see workers/DEPLOY.md
 */

const CPC_HISTORY_URL = 'https://www.cpc.com.tw/historyprice.aspx?n=2890';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const PRODUCT_MAP = {
  '92': { name: '92 Unleaded', nameZh: '92無鉛汽油' },
  '95': { name: '95 Unleaded', nameZh: '95無鉛汽油' },
  '98': { name: '98 Unleaded', nameZh: '98無鉛汽油' },
  'diesel': { name: 'Diesel', nameZh: '超級柴油' },
};

/**
 * Parse ROC date (e.g. "115/02/16") to ISO date string "2026-02-16"
 */
function parseRocDate(rocDate) {
  const match = rocDate.match(/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  const year = parseInt(match[1]) + 1911;
  return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

/**
 * Scrape CPC history page HTML and extract price table rows.
 * Each row: [date, 92, 95, 98, diesel]
 * Rows are ordered newest first in the HTML.
 */
function parseHistoryHtml(html) {
  // Extract <td> cells with data-title attributes
  // Pattern: data-title="調價日期">115/02/16</td>
  //          data-title="92 無鉛汽油">27.2</td>
  //          data-title="95 無鉛汽油">28.7</td>
  //          data-title="98 無鉛汽油">30.7</td>
  //          data-title="超級/高級柴油">26.6</td>
  const tdRegex = /<td[^>]*data-title="([^"]*)"[^>]*>([^<]*)<\/td>/g;
  const rows = [];
  let currentRow = {};
  let match;

  while ((match = tdRegex.exec(html)) !== null) {
    const title = match[1].trim();
    const value = match[2].trim();

    // Skip JS template rows (contain '+', 'filteredArray', etc.)
    if (value.includes('+') || value.includes('[') || value.includes('Array')) continue;

    if (title === '調價日期') {
      // Only accept ROC date format like 115/02/16
      if (!/^\d{2,3}\/\d{2}\/\d{2}$/.test(value)) continue;
      if (currentRow.date) rows.push(currentRow);
      currentRow = { date: value };
    } else if (title.includes('92')) {
      const p = parseFloat(value);
      if (p > 0) currentRow.p92 = p;
    } else if (title.includes('95')) {
      const p = parseFloat(value);
      if (p > 0) currentRow.p95 = p;
    } else if (title.includes('98')) {
      const p = parseFloat(value);
      if (p > 0) currentRow.p98 = p;
    } else if (title.includes('柴油')) {
      const p = parseFloat(value);
      if (p > 0) currentRow.diesel = p;
    }
  }
  if (currentRow.date && currentRow.p92) rows.push(currentRow);

  return rows;
}

/**
 * Build the full response from scraped rows
 */
function buildResponse(rows) {
  if (!rows || rows.length === 0) return null;

  // Rows are newest first
  const latest = rows[0];
  const latestDate = parseRocDate(latest.date);
  const latestDateEnd = latestDate ? addDays(latestDate, 6) : null;

  // Current prices
  const products = [
    { ...PRODUCT_MAP['92'], key: '92', price: latest.p92, unit: 'NT$/L' },
    { ...PRODUCT_MAP['95'], key: '95', price: latest.p95, unit: 'NT$/L' },
    { ...PRODUCT_MAP['98'], key: '98', price: latest.p98, unit: 'NT$/L' },
    { ...PRODUCT_MAP['diesel'], key: 'diesel', price: latest.diesel, unit: 'NT$/L' },
  ];

  // Predict next week: use trend from last 2 weeks
  const predict = [];
  const predictDate = latestDateEnd ? addDays(latestDateEnd, 1) : null;
  const predictDateEnd = predictDate ? addDays(predictDate, 6) : null;

  if (rows.length >= 2) {
    const prev = rows[1];
    for (const { key, field } of [
      { key: '92', field: 'p92' },
      { key: '95', field: 'p95' },
      { key: '98', field: 'p98' },
      { key: 'diesel', field: 'diesel' },
    ]) {
      const curr = latest[field];
      const prevVal = prev[field];
      const change = Math.round((curr - prevVal) * 10) / 10;
      // Simple prediction: continue the same trend
      const predicted = Math.round((curr + change) * 10) / 10;
      predict.push({ key, price: predicted, change });
    }
  }

  // History (last 8 weeks, chronological order)
  const historyRows = rows.slice(0, 8).reverse();
  const history = historyRows.map(r => {
    const isoDate = parseRocDate(r.date);
    const week = isoDate ? isoDate.slice(5) : r.date; // MM-DD
    return { week: week.replace('-', '/'), price95: r.p95 };
  });

  return {
    date: latestDate,
    dateEnd: latestDateEnd,
    products,
    predictDate,
    predictDateEnd,
    predictUpdated: new Date().toISOString().slice(0, 16).replace('T', ' '),
    predict,
    history,
    source: 'CPC',
    fetchedAt: new Date().toISOString(),
  };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Handle incoming requests
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/' || path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      service: 'CPC Oil Price Proxy',
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (path === '/oil-price') {
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
      const response = await fetch(CPC_HISTORY_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html',
        }
      });

      if (!response.ok) throw new Error(`CPC page returned ${response.status}`);

      const html = await response.text();
      const rows = parseHistoryHtml(html);

      if (!rows || rows.length === 0) {
        throw new Error('No price data found in CPC page');
      }

      const parsed = buildResponse(rows);
      if (!parsed || !parsed.products.length) {
        throw new Error('Failed to build price response');
      }

      const body = JSON.stringify(parsed);
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
      return new Response(JSON.stringify({
        error: 'Fetch error',
        message: error.message,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found', message: 'Use /oil-price' }), {
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
