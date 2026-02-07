# Deploy TDX Proxy to Cloudflare Workers

This guide shows how to deploy the TDX API proxy to Cloudflare Workers to securely use Taiwan bus data without exposing your API credentials.

## Prerequisites

1. Free Cloudflare account: https://dash.cloudflare.com/sign-up
2. Free TDX account: https://tdx.transportdata.tw/

## Step 1: Get TDX API Credentials (Free)

1. Go to https://tdx.transportdata.tw/
2. Click **會員申請** (Register) in the top right
3. Fill in the registration form and verify your email
4. After login, click **會員中心** (Member Center)
5. Go to **應用程式管理** (Application Management)
6. Click **新增應用程式** (Add Application)
   - Application Name: `bus-proxy` (or any name)
   - Description: `Bus data proxy`
7. After creation, you'll see:
   - **Client Id**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Client Secret**: `xxxx-xxxx-xxxx-xxxx` (click to reveal)
8. **Save these credentials** - you'll need them in Step 3

## Step 2: Create Cloudflare Worker

### Option A: Using Cloudflare Dashboard (Easiest)

1. Go to https://dash.cloudflare.com/
2. Select your account
3. Click **Workers & Pages** in the left sidebar
4. Click **Create application** → **Create Worker**
5. Name it `tdx-proxy` and click **Deploy**
6. Click **Edit code**
7. Delete all the default code
8. Copy and paste the entire contents of `tdx-proxy.js` into the editor
9. Click **Save and Deploy**

### Option B: Using Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create project directory
mkdir tdx-proxy && cd tdx-proxy

# Copy worker file
cp /path/to/workers/tdx-proxy.js ./index.js

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "tdx-proxy"
main = "index.js"
compatibility_date = "2024-01-01"
EOF

# Deploy
wrangler deploy
```

## Step 3: Configure Environment Variables

**This is the critical step to protect your credentials!**

### Using Dashboard:

1. In your Worker page, click **Settings** tab
2. Click **Variables** in the left menu
3. Under **Environment Variables**, click **Add variable**
4. Add these two variables:

| Variable Name | Value |
|--------------|-------|
| `TDX_CLIENT_ID` | Your Client Id from Step 1 |
| `TDX_CLIENT_SECRET` | Your Client Secret from Step 1 |

5. Click **Encrypt** for `TDX_CLIENT_SECRET` (recommended)
6. Click **Save and Deploy**

### Using Wrangler CLI:

```bash
# Set secrets (will prompt for values)
wrangler secret put TDX_CLIENT_ID
wrangler secret put TDX_CLIENT_SECRET
```

## Step 4: Test Your Worker

Your worker URL will be: `https://tdx-proxy.<your-subdomain>.workers.dev`

Test it in your browser:

```
https://tdx-proxy.xxxxx.workers.dev/health
```

Should return:
```json
{"status":"ok","service":"TDX Proxy","timestamp":"..."}
```

Test bus stops:
```
https://tdx-proxy.xxxxx.workers.dev/v2/Bus/Stop/City/Taipei?$top=5&$format=JSON
```

## Step 5: Update bus.html

Edit `bus.html` and update the configuration at the top of the `<script>` section:

```javascript
// TDX Proxy Configuration
const TDX_PROXY_URL = 'https://tdx-proxy.YOUR-SUBDOMAIN.workers.dev';

// Set this to true to use the proxy
const USE_PROXY = true;
```

Or simply update the `TDX_CONFIG.proxyUrl` value:

```javascript
const TDX_CONFIG = {
    proxyUrl: 'https://tdx-proxy.YOUR-SUBDOMAIN.workers.dev', // Your worker URL
    // ... rest of config
};
```

## Free Tier Limits

Cloudflare Workers free tier includes:
- **100,000 requests/day**
- **10ms CPU time per request**
- Unlimited bandwidth

This is more than enough for personal use!

## Troubleshooting

### "TDX credentials not configured"
- Make sure you added both `TDX_CLIENT_ID` and `TDX_CLIENT_SECRET` in Worker Settings → Variables
- Click "Save and Deploy" after adding variables

### "TDX auth failed: 401"
- Double-check your Client ID and Secret from TDX
- Make sure you copied them without extra spaces

### CORS errors
- The worker already includes CORS headers
- If issues persist, check browser console for specific error

### "429 Too Many Requests"
- TDX has rate limits; the proxy caches tokens to minimize auth calls
- If you hit limits, wait a few minutes

## API Endpoints Available

Once deployed, you can access any TDX Bus API through your proxy:

| Endpoint | Description |
|----------|-------------|
| `/v2/Bus/Stop/City/{City}` | Bus stops in a city |
| `/v2/Bus/EstimatedTimeOfArrival/City/{City}` | Arrival times |
| `/v2/Bus/Route/City/{City}` | Bus routes |
| `/v2/Bus/RealTimeByFrequency/City/{City}` | Real-time bus positions |
| `/v2/Bus/Stop/InterCity` | Intercity bus stops |

### Query Parameters

TDX supports OData query parameters:
- `$top=N` - Limit results
- `$skip=N` - Skip results (pagination)
- `$filter=...` - Filter results
- `$spatialFilter=nearby(lat,lng,radius)` - Find nearby
- `$format=JSON` - Response format

Example:
```
/v2/Bus/Stop/City/Taipei?$spatialFilter=nearby(25.033,121.565,500)&$top=20&$format=JSON
```

## Security Notes

1. **Never commit credentials** to your git repository
2. Environment variables in Cloudflare Workers are **encrypted at rest**
3. The proxy only exposes the data, not your credentials
4. Consider adding rate limiting or authentication to your proxy for production use
