/**
 * Earthquake Notification Worker for Cloudflare
 *
 * Monitors USGS earthquake data near Taiwan and sends push/email notifications.
 * Uses Cloudflare KV for subscription storage and Cron Triggers for scheduled checks.
 *
 * Required KV Namespaces (bind in wrangler.toml):
 *   - PUSH_SUBSCRIPTIONS   — Web Push subscription objects
 *   - EMAIL_SUBSCRIPTIONS  — Email addresses + preferences
 *   - PROCESSED_QUAKES     — Already-notified earthquake IDs (TTL: 7 days)
 *
 * Required Environment Secrets:
 *   - VAPID_PUBLIC_KEY     — VAPID public key for Web Push
 *   - VAPID_PRIVATE_KEY    — VAPID private key for Web Push
 *   - VAPID_SUBJECT        — mailto: URL for VAPID
 *   - EMAIL_API_KEY        — API key for email provider (Resend/Mailgun/Brevo)
 *   - EMAIL_API_URL        — Email provider API endpoint
 *   - EMAIL_FROM           — Sender email address
 *
 * Deploy:
 *   npx wrangler deploy workers/earthquake-notify.js
 *
 * Cron Trigger (wrangler.toml):
 *   [triggers]
 *   crons = ["*/30 * * * *"]  # Every 30 minutes
 */

const USGS_API = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const DEFAULT_MIN_MAG = 4.0;
const QUAKE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

// Taiwan region bounding box (~1000km radius)
const REGION = {
  minlatitude: 18,
  maxlatitude: 30,
  minlongitude: 116,
  maxlongitude: 130
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// USGS DATA FETCHING
// ============================================================

/**
 * Fetch recent significant earthquakes from USGS
 */
async function fetchRecentQuakes(minMag = DEFAULT_MIN_MAG, hoursBack = 1) {
  const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    format: 'geojson',
    ...REGION,
    minmagnitude: minMag,
    orderby: 'time',
    limit: 50,
    starttime: startTime
  });

  const response = await fetch(`${USGS_API}?${params}`);
  if (!response.ok) throw new Error(`USGS API error: ${response.status}`);

  const data = await response.json();
  return data.features || [];
}

// ============================================================
// WEB PUSH
// ============================================================

/**
 * Sign and send a Web Push notification
 * Implements VAPID-based Web Push (RFC 8291/8292)
 */
async function sendWebPush(subscription, payload, env) {
  // Web Push requires crypto operations for VAPID signing.
  // In production, use a library like web-push or implement
  // the VAPID JWT signing with Cloudflare Workers crypto API.
  //
  // For now, this is a structural placeholder that shows the
  // expected flow. Full VAPID implementation requires:
  // 1. Generate JWT with ES256 using VAPID_PRIVATE_KEY
  // 2. Encrypt payload using subscription keys (p256dh, auth)
  // 3. Send POST to subscription.endpoint with encrypted body

  const body = JSON.stringify(payload);

  try {
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'TTL': '86400',
        // In production: add Authorization and Crypto-Key headers
      },
      body: body
    });

    if (!response.ok) {
      console.error(`Push failed for ${subscription.endpoint}: ${response.status}`);
      // If 404 or 410, subscription is expired - should be removed
      if (response.status === 404 || response.status === 410) {
        return { expired: true, endpoint: subscription.endpoint };
      }
    }
    return { success: response.ok };
  } catch (error) {
    console.error('Push send error:', error);
    return { error: error.message };
  }
}

/**
 * Send push notifications to all subscribers for a given earthquake
 */
async function notifyPushSubscribers(quake, env) {
  if (!env.PUSH_SUBSCRIPTIONS) return [];

  const list = await env.PUSH_SUBSCRIPTIONS.list();
  const results = [];

  const mag = quake.properties.mag.toFixed(1);
  const place = quake.properties.place || 'Near Taiwan';
  const depth = quake.geometry.coordinates[2].toFixed(1);

  const payload = {
    title: `Earthquake M${mag}`,
    body: `${place}\nDepth: ${depth} km`,
    icon: '/img/icon-180.png',
    badge: '/img/icon-180.png',
    url: quake.properties.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.id}`,
    data: {
      quakeId: quake.id,
      mag: quake.properties.mag,
      time: quake.properties.time
    }
  };

  for (const key of list.keys) {
    try {
      const subData = await env.PUSH_SUBSCRIPTIONS.get(key.name, { type: 'json' });
      if (!subData || !subData.subscription) continue;

      // Check minimum magnitude preference
      const minMag = subData.minMag || DEFAULT_MIN_MAG;
      if (quake.properties.mag < minMag) continue;

      // Check quiet hours
      if (subData.quietEnabled && subData.quietStart && subData.quietEnd) {
        const now = new Date();
        const hours = now.getUTCHours() + 8; // Taiwan UTC+8
        const currentTime = `${(hours % 24).toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (isInQuietHours(currentTime, subData.quietStart, subData.quietEnd)) continue;
      }

      const result = await sendWebPush(subData.subscription, payload, env);
      results.push(result);

      // Remove expired subscriptions
      if (result.expired) {
        await env.PUSH_SUBSCRIPTIONS.delete(key.name);
      }
    } catch (error) {
      console.error(`Error notifying ${key.name}:`, error);
    }
  }

  return results;
}

// ============================================================
// EMAIL NOTIFICATIONS
// ============================================================

/**
 * Send email notification for an earthquake
 */
async function sendEmailNotification(email, quake, env) {
  if (!env.EMAIL_API_KEY || !env.EMAIL_API_URL || !env.EMAIL_FROM) {
    console.warn('Email not configured, skipping');
    return { skipped: true };
  }

  const mag = quake.properties.mag.toFixed(1);
  const place = quake.properties.place || 'Near Taiwan';
  const depth = quake.geometry.coordinates[2].toFixed(1);
  const time = new Date(quake.properties.time).toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
  const usgsUrl = quake.properties.url || `https://earthquake.usgs.gov/earthquakes/eventpage/${quake.id}`;
  const [lng, lat] = quake.geometry.coordinates;

  const subject = `Earthquake Alert: M${mag} - ${place}`;
  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#d32f2f;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">Earthquake Alert</h2>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;font-weight:bold;width:120px;">Magnitude</td><td style="padding:8px 0;"><strong style="font-size:1.3em;color:#d32f2f;">M ${mag}</strong></td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Location</td><td style="padding:8px 0;">${place}</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Depth</td><td style="padding:8px 0;">${depth} km</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Time</td><td style="padding:8px 0;">${time} (Taipei)</td></tr>
          <tr><td style="padding:8px 0;font-weight:bold;">Coordinates</td><td style="padding:8px 0;">${lat.toFixed(3)}, ${lng.toFixed(3)}</td></tr>
        </table>
        <div style="margin-top:16px;">
          <a href="${usgsUrl}" style="display:inline-block;padding:10px 20px;background:#1976d2;color:white;text-decoration:none;border-radius:4px;margin-right:8px;">View on USGS</a>
          <a href="https://oouyang.github.io/ubike/earthquake.html" style="display:inline-block;padding:10px 20px;background:#388e3c;color:white;text-decoration:none;border-radius:4px;">Open Earthquake Map</a>
        </div>
        <p style="margin-top:16px;font-size:0.85em;color:#888;">
          Data from USGS Earthquake Hazards Program. To unsubscribe, visit the earthquake map and update your notification settings.
        </p>
      </div>
    </div>
  `;

  try {
    // Generic email API call - adapt for your provider (Resend, Mailgun, Brevo)
    const response = await fetch(env.EMAIL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [email],
        subject: subject,
        html: htmlBody,
      }),
    });

    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error('Email send error:', error);
    return { error: error.message };
  }
}

/**
 * Send email notifications to all subscribers for a given earthquake
 */
async function notifyEmailSubscribers(quake, env) {
  if (!env.EMAIL_SUBSCRIPTIONS) return [];

  const list = await env.EMAIL_SUBSCRIPTIONS.list();
  const results = [];

  for (const key of list.keys) {
    try {
      const subData = await env.EMAIL_SUBSCRIPTIONS.get(key.name, { type: 'json' });
      if (!subData || !subData.email) continue;

      // Check minimum magnitude preference
      const minMag = subData.minMag || DEFAULT_MIN_MAG;
      if (quake.properties.mag < minMag) continue;

      const result = await sendEmailNotification(subData.email, quake, env);
      results.push(result);
    } catch (error) {
      console.error(`Error emailing ${key.name}:`, error);
    }
  }

  return results;
}

// ============================================================
// HELPERS
// ============================================================

function isInQuietHours(current, start, end) {
  if (start <= end) {
    return current >= start && current <= end;
  }
  // Wraps past midnight (e.g., 22:00 to 07:00)
  return current >= start || current <= end;
}

function getSubscriptionKey(endpoint) {
  // Create a consistent key from the push subscription endpoint
  const url = new URL(endpoint);
  return url.pathname.replace(/\//g, '_').substring(0, 100);
}

// ============================================================
// REQUEST HANDLERS
// ============================================================

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === '/' || path === '/health') {
    return jsonResponse({
      status: 'ok',
      service: 'Earthquake Notification Worker',
      timestamp: new Date().toISOString(),
    });
  }

  // Subscribe to push notifications
  if (path === '/subscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.subscription || !body.subscription.endpoint) {
        return jsonResponse({ error: 'Missing subscription data' }, 400);
      }

      const key = getSubscriptionKey(body.subscription.endpoint);
      await env.PUSH_SUBSCRIPTIONS.put(key, JSON.stringify({
        subscription: body.subscription,
        minMag: body.minMag || DEFAULT_MIN_MAG,
        quietEnabled: body.quietEnabled || false,
        quietStart: body.quietStart || null,
        quietEnd: body.quietEnd || null,
        createdAt: new Date().toISOString(),
      }));

      return jsonResponse({ success: true, message: 'Subscribed to push notifications' });
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Unsubscribe from push notifications
  if (path === '/unsubscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.endpoint) {
        return jsonResponse({ error: 'Missing endpoint' }, 400);
      }

      const key = getSubscriptionKey(body.endpoint);
      await env.PUSH_SUBSCRIPTIONS.delete(key);

      return jsonResponse({ success: true, message: 'Unsubscribed from push notifications' });
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Subscribe to email alerts
  if (path === '/email/subscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.email || !body.email.includes('@')) {
        return jsonResponse({ error: 'Invalid email' }, 400);
      }

      const key = body.email.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
      await env.EMAIL_SUBSCRIPTIONS.put(key, JSON.stringify({
        email: body.email.toLowerCase(),
        minMag: body.minMag || DEFAULT_MIN_MAG,
        createdAt: new Date().toISOString(),
      }));

      return jsonResponse({ success: true, message: 'Subscribed to email alerts' });
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Unsubscribe from email alerts
  if (path === '/email/unsubscribe' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.email) {
        return jsonResponse({ error: 'Missing email' }, 400);
      }

      const key = body.email.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
      await env.EMAIL_SUBSCRIPTIONS.delete(key);

      return jsonResponse({ success: true, message: 'Unsubscribed from email alerts' });
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Check subscription status
  if (path === '/subscriptions/status' && request.method === 'GET') {
    const endpoint = url.searchParams.get('endpoint');
    const email = url.searchParams.get('email');

    const result = {};

    if (endpoint && env.PUSH_SUBSCRIPTIONS) {
      const key = getSubscriptionKey(endpoint);
      const sub = await env.PUSH_SUBSCRIPTIONS.get(key);
      result.push = !!sub;
    }

    if (email && env.EMAIL_SUBSCRIPTIONS) {
      const key = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
      const sub = await env.EMAIL_SUBSCRIPTIONS.get(key);
      result.email = !!sub;
    }

    return jsonResponse(result);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ============================================================
// SCHEDULED HANDLER (Cron Trigger)
// ============================================================

async function handleScheduled(event, env) {
  console.log('Earthquake notification check started');

  try {
    // Fetch earthquakes from the last hour with mag >= 4.0
    const quakes = await fetchRecentQuakes(DEFAULT_MIN_MAG, 1);
    console.log(`Found ${quakes.length} significant earthquakes`);

    let notifiedCount = 0;

    for (const quake of quakes) {
      // Check if we already processed this earthquake
      const processed = await env.PROCESSED_QUAKES.get(quake.id);
      if (processed) {
        console.log(`Skipping already-processed quake: ${quake.id}`);
        continue;
      }

      console.log(`New earthquake: M${quake.properties.mag.toFixed(1)} - ${quake.properties.place}`);

      // Send notifications in parallel
      const [pushResults, emailResults] = await Promise.all([
        notifyPushSubscribers(quake, env),
        notifyEmailSubscribers(quake, env),
      ]);

      // Mark as processed (TTL: 7 days)
      await env.PROCESSED_QUAKES.put(quake.id, JSON.stringify({
        mag: quake.properties.mag,
        place: quake.properties.place,
        time: quake.properties.time,
        processedAt: new Date().toISOString(),
        pushSent: pushResults.length,
        emailSent: emailResults.length,
      }), { expirationTtl: QUAKE_TTL });

      notifiedCount++;
    }

    console.log(`Earthquake check complete: ${notifiedCount} new earthquakes notified`);
  } catch (error) {
    console.error('Scheduled handler error:', error);
  }
}

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
