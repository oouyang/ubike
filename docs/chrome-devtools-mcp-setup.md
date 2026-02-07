# Chrome DevTools MCP Setup Guide

This guide covers how to set up and troubleshoot Chrome DevTools MCP (Model Context Protocol) for browser automation with Claude Code.

## Prerequisites

- Google Chrome installed
- Claude Code CLI
- `libnss3-tools` package (for certificate management on Linux)

```bash
sudo apt-get install libnss3-tools
```

## Quick Start

1. **Start Chrome DevTools MCP** in Claude Code:

   ```
   /mcp
   ```

2. **Reconnect** if needed:
   ```
   /mcp
   ```
   This will restart Chrome and reconnect the MCP server.

## Common Commands

### Navigation

```javascript
// Navigate to URL
mcp__chrome -
  devtools__navigate_page({ type: "url", url: "https://example.com" });

// Reload page
mcp__chrome - devtools__navigate_page({ type: "reload", ignoreCache: true });

// Go back/forward
mcp__chrome - devtools__navigate_page({ type: "back" });
mcp__chrome - devtools__navigate_page({ type: "forward" });
```

### Page Inspection

```javascript
// Take accessibility snapshot (preferred over screenshots)
mcp__chrome - devtools__take_snapshot();

// Take screenshot
mcp__chrome - devtools__take_screenshot();

// List all pages
mcp__chrome - devtools__list_pages();
```

### Console & Network

```javascript
// List console errors/warnings
mcp__chrome - devtools__list_console_messages({ types: ["error", "warn"] });

// Get specific console message details
mcp__chrome - devtools__get_console_message({ msgid: 9 });

// List network requests by type
mcp__chrome -
  devtools__list_network_requests({
    resourceTypes: ["script", "xhr", "fetch"],
  });
```

### Interaction

```javascript
// Click element (use uid from snapshot)
mcp__chrome - devtools__click({ uid: "1_32" });

// Fill input field
mcp__chrome - devtools__fill({ uid: "1_33", value: "search text" });

// Press key
mcp__chrome - devtools__press_key({ key: "Enter" });
```

## Troubleshooting

### SSL Certificate Errors (ERR_CERT_AUTHORITY_INVALID)

**Symptom:** CDN resources fail to load with `net::ERR_CERT_AUTHORITY_INVALID`

**Cause:** Corporate proxy (e.g., Zscaler) intercepting HTTPS traffic with its own certificate

**Solution:** Add the corporate CA certificate to Chrome's NSS database

#### Step 1: Identify the certificate issuer

```bash
openssl s_client -connect unpkg.com:443 -servername unpkg.com </dev/null 2>&1 | openssl x509 -noout -issuer
```

Example output:

```
issuer=C=US, L=Boise, ST=Idaho, O=cdn tool, OU=Security Operations, CN=test.example.com (t)
```

#### Step 2: Split certificate bundle (if multiple certs)

```bash
cd /tmp
csplit -f cert- -b '%03d.pem' /path/to/ca-bundle.pem '/-----BEGIN CERTIFICATE-----/' '{*}'
```

#### Step 3: Add certificates to Chrome's NSS database

```bash
# Add single certificate
certutil -d sql:$HOME/.pki/nssdb -A -t "CT,C,C" -n "Certificate Name" -i /path/to/cert.pem

# Add all certificates from split bundle
for i in cert-*.pem; do
  if [ -s "$i" ] && grep -q "BEGIN CERTIFICATE" "$i"; then
    name=$(openssl x509 -in "$i" -noout -subject 2>/dev/null | sed 's/subject=//' | head -1)
    [ -z "$name" ] && name="$i"
    certutil -d sql:$HOME/.pki/nssdb -A -t "CT,C,C" -n "$name" -i "$i" 2>/dev/null
  fi
done
```

#### Step 4: Verify certificate was added

```bash
certutil -L -d sql:$HOME/.pki/nssdb | grep -i "your-cert-name"
```

#### Step 5: Restart Chrome

Run `/mcp` in Claude Code to restart Chrome with the updated certificate store.

### Leaflet/Library Not Loading

**Symptom:** `L is not defined` or similar errors for CDN libraries

**Diagnosis:**

1. Check console errors:

   ```javascript
   mcp__chrome - devtools__list_console_messages({ types: ["error"] });
   ```

2. Check network requests:
   ```javascript
   mcp__chrome - devtools__list_network_requests({ resourceTypes: ["script"] });
   ```

**Common causes:**

- SSL certificate issues (see above)
- CDN blocked by firewall
- Script loading order issues

### Page Not Responding

**Solution:** Kill and restart the MCP:

```bash
pkill -f "chrome-devtools-mcp"
```

Then run `/mcp` again in Claude Code.

### NSS Database Issues

**Symptom:** `SEC_ERROR_BAD_DATABASE` when using certutil

**Solution:** Run certutil from the nssdb directory:

```bash
cd ~/.pki/nssdb && certutil -L -d sql:.
```

Or recreate the database:

```bash
rm -rf ~/.pki/nssdb
mkdir -p ~/.pki/nssdb
certutil -d sql:$HOME/.pki/nssdb -N --empty-password
```

## Chrome Profile Location

Chrome DevTools MCP uses a separate profile at:

```
~/.cache/chrome-devtools-mcp/chrome-profile/
```

This is independent of your regular Chrome profile.

## Resource Types for Network Filtering

| Type         | Description           |
| ------------ | --------------------- |
| `document`   | HTML documents        |
| `stylesheet` | CSS files             |
| `script`     | JavaScript files      |
| `image`      | Images                |
| `font`       | Web fonts             |
| `xhr`        | XMLHttpRequest        |
| `fetch`      | Fetch API requests    |
| `websocket`  | WebSocket connections |
| `media`      | Audio/Video           |

## Console Message Types

| Type    | Description     |
| ------- | --------------- |
| `log`   | console.log()   |
| `info`  | console.info()  |
| `warn`  | console.warn()  |
| `error` | console.error() |
| `debug` | console.debug() |

## Best Practices

1. **Use snapshots over screenshots** - Snapshots provide element UIDs for interaction and are faster
2. **Check console errors first** - Most issues show up in console
3. **Filter network requests** - Use `resourceTypes` to narrow down issues
4. **Restart MCP after certificate changes** - Chrome caches certificate decisions
5. **Use `includeSnapshot: true`** - Get updated snapshot after interactions

## Example Debugging Session

```javascript
// 1. Navigate to page
mcp__chrome -
  devtools__navigate_page({ type: "url", url: "https://example.com" });

// 2. Check for errors
mcp__chrome - devtools__list_console_messages({ types: ["error", "warn"] });

// 3. Check if scripts loaded
mcp__chrome - devtools__list_network_requests({ resourceTypes: ["script"] });

// 4. Take snapshot to see page state
mcp__chrome - devtools__take_snapshot();

// 5. Interact with elements using UIDs from snapshot
mcp__chrome - devtools__click({ uid: "1_5", includeSnapshot: true });
```
