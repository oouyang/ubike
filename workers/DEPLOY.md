# Deploy Cloudflare Workers

This guide covers deploying all four proxy workers used by the Taiwan Transport PWA.

| Worker | File | Purpose | Credentials |
|--------|------|---------|-------------|
| `tdx-proxy` | `tdx-proxy.js` | TDX bus/rail API proxy | TDX Client ID/Secret |
| `oil-price-proxy` | `oil-price-proxy.js` | CPC oil price proxy | None |
| `twse-etf-proxy` | `twse-etf-proxy.js` | TWSE ETF data proxy | None |
| `earthquake-notify` | `earthquake-notify.js` | Earthquake push/email alerts | VAPID keys (optional) |

## Prerequisites

1. Free Cloudflare account: https://dash.cloudflare.com/sign-up
2. (TDX only) Free TDX account: https://tdx.transportdata.tw/

## Quick Deploy (All Workers)

Each worker follows the same deployment steps. Repeat for each worker you want to deploy.

### Option A: Cloudflare Dashboard (Easiest)

1. Go to https://dash.cloudflare.com/
2. Select your account → **Workers & Pages** → **Create application** → **Create Worker**
3. Name it (e.g., `oil-price-proxy`) and click **Deploy**
4. Click **Edit code**
5. Delete all default code, paste the contents of the corresponding `.js` file
6. Click **Save and Deploy**

### Option B: Wrangler CLI

```bash
# Install Wrangler (one-time)
npm install -g wrangler
wrangler login

# Deploy a worker (repeat for each)
cd /path/to/ubike/workers
wrangler deploy --name oil-price-proxy oil-price-proxy.js
wrangler deploy --name twse-etf-proxy twse-etf-proxy.js
wrangler deploy --name earthquake-notify earthquake-notify.js
wrangler deploy --name tdx-proxy tdx-proxy.js
```

Or with a `wrangler.toml` per worker:

```bash
mkdir oil-price-proxy && cd oil-price-proxy
cp ../oil-price-proxy.js ./index.js
cat > wrangler.toml << 'EOF'
name = "oil-price-proxy"
main = "index.js"
compatibility_date = "2024-01-01"
EOF
wrangler deploy
```

---

## 1. Oil Price Proxy (`oil-price-proxy.js`)

Proxies Taiwan CPC (中油) oil price data with CORS headers. Caches for 1 hour.

### Environment Variables

**None required.** This worker fetches from the public CPC endpoint.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /oil-price` | Current CPC oil prices (92/95/98/diesel) |

### Test

```
https://oil-price-proxy.YOUR-SUBDOMAIN.workers.dev/health
https://oil-price-proxy.YOUR-SUBDOMAIN.workers.dev/oil-price
```

### Connect to `oil.html`

Edit `oil.html` and set the `WORKER_URL` constant:

```javascript
const WORKER_URL = 'https://oil-price-proxy.YOUR-SUBDOMAIN.workers.dev';
```

When set, the page fetches live CPC prices instead of showing demo data.

---

## 2. TWSE ETF Proxy (`twse-etf-proxy.js`)

Proxies Taiwan Stock Exchange OpenAPI for ETF price/yield data. Caches for 1 hour.

### Environment Variables

**None required.** This worker fetches from the public TWSE OpenAPI.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /etf-list` | All Taiwan-listed ETFs with price, yield, P/E |

### Test

```
https://twse-etf-proxy.YOUR-SUBDOMAIN.workers.dev/health
https://twse-etf-proxy.YOUR-SUBDOMAIN.workers.dev/etf-list
```

### Connect to `etf.html`

Edit `etf.html` and set the `WORKER_URL` constant:

```javascript
const WORKER_URL = 'https://twse-etf-proxy.YOUR-SUBDOMAIN.workers.dev';
```

**Note:** `etf.html` also tries fetching directly from `openapi.twse.com.tw` (which works from most browsers). The Worker is a fallback for environments where CORS is blocked.

---

## 3. Earthquake Notify (`earthquake-notify.js`)

Cloudflare Worker that periodically checks USGS for new earthquakes and sends push notifications and/or email alerts to subscribers.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPID_PUBLIC_KEY` | For push | VAPID public key for web push |
| `VAPID_PRIVATE_KEY` | For push | VAPID private key for web push |
| `VAPID_SUBJECT` | For push | `mailto:` URL (e.g. `mailto:you@example.com`) |
| `EMAIL_API_BASE` | For email | Email API base URL (default: `https://m.taleon.work.gd/xsw/api/admin/email`) |

### KV Namespaces

The worker uses three Cloudflare KV namespaces to store subscriptions and processed earthquake IDs. Create them and bind in `wrangler.toml`:

```bash
# Create KV namespaces
wrangler kv:namespace create PUSH_SUBSCRIPTIONS
wrangler kv:namespace create EMAIL_SUBSCRIPTIONS
wrangler kv:namespace create PROCESSED_QUAKES
```

Each command outputs a binding ID. Add them to `wrangler.toml`:

```toml
name = "earthquake-notify"
main = "index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "PUSH_SUBSCRIPTIONS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "EMAIL_SUBSCRIPTIONS"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[[kv_namespaces]]
binding = "PROCESSED_QUAKES"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[triggers]
crons = ["*/10 * * * *"]
```

Or via Dashboard: Worker → **Settings** → **KV Namespace Bindings** → Add binding.

### Set Up Email Alerts

Email alerts use a custom API endpoint. The default is `https://m.taleon.work.gd/xsw/api/admin/email`.

**API format:**
```
POST {EMAIL_API_BASE}/send?to_email={email}&subject={subject}&body={html}&is_html=true
```

**To use the default API**, no configuration is needed — it works out of the box.

**To use a custom email API**, set the environment variable:

**Dashboard:** Worker → Settings → Variables → Add:

| Variable | Value | Encrypt? |
|----------|-------|----------|
| `EMAIL_API_BASE` | `https://your-api.example.com/email` | No |

**CLI:**
```bash
wrangler secret put EMAIL_API_BASE
# Paste: https://your-api.example.com/email
```

Your custom API must accept the same query parameter format:
- `to_email` — Recipient email address
- `subject` — Email subject line
- `body` — Email body (HTML)
- `is_html` — `true` for HTML emails

**Test** by subscribing an email on the earthquake page, then wait for a M4+ earthquake (or temporarily lower `DEFAULT_MIN_MAG` in the worker to test with smaller events).

### Generate VAPID Keys (Push Notifications)

```bash
npx web-push generate-vapid-keys
```

Output:
```
Public Key:  BNxGMn...
Private Key: abc123...
```

```bash
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
# Paste: mailto:you@example.com
```

### Set Up Cron Trigger

The worker checks USGS for new earthquakes on a schedule.

**In `wrangler.toml`:**
```toml
[triggers]
crons = ["*/10 * * * *"]  # Every 10 minutes
```

**Or via Dashboard:** Worker → **Triggers** → **Cron Triggers** → Add `*/10 * * * *`.

The cron handler:
1. Fetches M4.0+ earthquakes from the last hour
2. Skips already-processed events (tracked in KV with 7-day TTL)
3. Sends push + email notifications to all matching subscribers
4. Respects per-subscriber min magnitude and quiet hours settings

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/subscribe` | POST | Subscribe to push (`{ subscription, minMag, quietEnabled, quietStart, quietEnd }`) |
| `/unsubscribe` | POST | Unsubscribe from push (`{ endpoint }`) |
| `/email/subscribe` | POST | Subscribe to email (`{ email, minMag }`) |
| `/email/unsubscribe` | POST | Unsubscribe from email (`{ email }`) |
| `/subscriptions/status` | GET | Check status (`?endpoint=...&email=...`) |

### Connect to `earthquake.html`

Edit `earthquake.html` and set the `WORKER_URL` constant:

```javascript
const WORKER_URL = 'https://earthquake-notify.YOUR-SUBDOMAIN.workers.dev';
```

Also update the VAPID public key in the push subscription code if using browser push.

### How It Works

```
Every 10 min (cron) → Fetch USGS API → New M4+ earthquake?
                                            │
                        ┌───────────────────┤
                        ▼                   ▼
                  Push subscribers     Email subscribers
                  (KV: PUSH_SUBS)     (KV: EMAIL_SUBS)
                        │                   │
                   Check minMag        Check minMag
                   Check quiet hrs          │
                        │                   │
                   Web Push API       Email API
                   (VAPID signed)     (POST /send?to_email=...)
                        │                   │
                        ▼                   ▼
                  Browser notif        Email inbox
```

---

## 4. TDX Proxy (`tdx-proxy.js`)

Proxies Taiwan TDX (Transport Data eXchange) API for bus/rail real-time data. Requires TDX credentials.

### Get TDX API Credentials (Free)

1. Go to https://tdx.transportdata.tw/
2. Click **會員申請** (Register) and verify your email
3. After login → **會員中心** → **應用程式管理** → **新增應用程式**
4. Save the **Client Id** and **Client Secret**

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TDX_CLIENT_ID` | Yes | TDX application Client Id |
| `TDX_CLIENT_SECRET` | Yes | TDX application Client Secret |

### Set Secrets

**Dashboard:** Worker → **Settings** → **Variables** → Add variables → Click **Encrypt** for the secret.

**CLI:**
```bash
wrangler secret put TDX_CLIENT_ID
wrangler secret put TDX_CLIENT_SECRET
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api` | List available API endpoints |
| `GET /v2/Bus/Stop/City/{City}` | Bus stops in a city |
| `GET /v2/Bus/EstimatedTimeOfArrival/City/{City}` | Arrival times |
| `GET /v2/Bus/Route/City/{City}` | Bus routes |
| `GET /v2/Bus/RealTimeByFrequency/City/{City}` | Real-time bus positions |

### Query Parameters (OData)

- `$top=N` — Limit results
- `$skip=N` — Pagination
- `$filter=...` — Filter expression
- `$spatialFilter=nearby(lat,lng,radius)` — Find nearby
- `$format=JSON` — Response format

### Test

```
https://tdx-proxy.YOUR-SUBDOMAIN.workers.dev/health
https://tdx-proxy.YOUR-SUBDOMAIN.workers.dev/v2/Bus/Stop/City/Taipei?$top=5&$format=JSON
```

### Connect to `bus.html`

Update the TDX proxy URL configuration in `bus.html`:

```javascript
const TDX_CONFIG = {
    proxyUrl: 'https://tdx-proxy.YOUR-SUBDOMAIN.workers.dev',
};
```

---

## Cloudflare Free Tier Limits

| Resource | Limit |
|----------|-------|
| Requests | 100,000/day |
| CPU time | 10ms/request |
| Bandwidth | Unlimited |
| Workers | 30 per account |
| Cron triggers | 5 per worker |
| KV storage | 1GB (if using KV for subscriptions) |

More than enough for personal use.

## Caching Behavior

All workers use Cloudflare's edge cache:

| Worker | Cache TTL | Reason |
|--------|-----------|--------|
| `oil-price-proxy` | 1 hour | Prices change weekly |
| `twse-etf-proxy` | 1 hour | Market data updates after close |
| `earthquake-notify` | N/A | Real-time checks via cron |
| `tdx-proxy` | 30s–24h | Varies by endpoint type |

## Troubleshooting

### "TDX credentials not configured"
- Add both `TDX_CLIENT_ID` and `TDX_CLIENT_SECRET` in Worker Settings → Variables
- Click "Save and Deploy" after adding

### "TDX auth failed: 401"
- Double-check credentials from TDX member center
- Ensure no extra whitespace

### CORS errors
- All workers include `Access-Control-Allow-Origin: *` headers
- Check browser console for the specific blocked URL

### "429 Too Many Requests"
- TDX has rate limits; the proxy caches tokens
- TWSE OpenAPI may throttle during market hours
- Wait a few minutes and retry

### Worker returns 502
- The upstream API (CPC/TWSE/USGS) may be temporarily down
- Check the worker's **Real-time Logs** in the Dashboard for details

## Security Notes

1. **Never commit credentials** to git
2. Use Cloudflare's **Encrypt** option for secret variables
3. Workers expose only the data, never your credentials
4. Consider adding rate limiting or authentication for production use
