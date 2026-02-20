# Usage Guide

A practical reference for developing, deploying, and operating this bot.

## Quick Reference

```bash
bun run dev        # Start local dev server (port 8787)
bun run deploy     # Deploy to Cloudflare Workers
bun test           # Run tests with Vitest
```

## Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| Bun | Runtime & package manager | https://bun.sh |
| Wrangler CLI | Cloudflare Workers CLI (bundled via bun) | `bun install` |
| ngrok | Expose local dev server for webhook testing | https://ngrok.com |

### Accounts & Keys

| What | Where to get it |
|------|-----------------|
| Cloudflare account | https://dash.cloudflare.com/sign-up |
| Telegram Bot Token | Message [@BotFather](https://t.me/botfather) on Telegram, use `/newbot` |
| Google Safe Browsing API Key | https://console.cloud.google.com → APIs & Services → Credentials |

## First-Time Setup

```bash
# 1. Install dependencies
bun install

# 2. Login to Cloudflare
bunx wrangler login

# 3. Set secrets (never put these in wrangler.jsonc)
echo "YOUR_BOT_TOKEN" | bunx wrangler secret put BOT_TOKEN
echo "YOUR_GOOGLE_API_KEY" | bunx wrangler secret put GOOGLE_API_KEY

# 4. Create KV namespace (skip if already exists)
bunx wrangler kv namespace create shorturl
# Copy the output namespace ID into wrangler.jsonc if it differs

# 5. Deploy
bun run deploy

# 6. Set Telegram webhook to your worker URL
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://urltools.YOUR_SUBDOMAIN.workers.dev/webhook"}'
```

The worker name is `urltools` (set in `wrangler.jsonc`), so the default URL is `https://urltools.<your-subdomain>.workers.dev`.

## Local Development

You need 3 terminals:

```bash
# Terminal 1 — run the worker locally
bun run dev
# Starts on http://localhost:8787

# Terminal 2 — expose to the internet
ngrok http 8787
# Note the https://xxxxx.ngrok.io URL

# Terminal 3 — point Telegram webhook to ngrok
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://xxxxx.ngrok.io/webhook"}'
```

After this, messages sent to your bot in Telegram will hit your local dev server.

### Local Dev with Secrets

For local development, create a `.dev.vars` file (already in `.gitignore`):

```
BOT_TOKEN=your-bot-token-here
GOOGLE_API_KEY=your-google-api-key-here
```

`wrangler dev` automatically reads `.dev.vars` and injects them as globals.

### Testing Changes Locally

After changing `src/index.js`, the dev server auto-reloads. To test manually:

```bash
# Test the root endpoint
curl http://localhost:8787/

# Test QR code generation
curl "http://localhost:8787/qrcode?url=https://example.com" -o test.png

# Simulate a Telegram webhook message
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"/start","chat":{"id":123456},"from":{"id":123456}}}'

# Simulate sending a URL to shorten
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"message":{"text":"https://example.com","chat":{"id":123456},"from":{"id":123456}}}'
```

## Deploying

```bash
bun run deploy
```

This runs `wrangler deploy`, which bundles `src/index.js` and pushes it to Cloudflare's edge.

After deploying, make sure the Telegram webhook points to your production URL (not ngrok):

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://urltools.YOUR_SUBDOMAIN.workers.dev/webhook"}'
```

## Project Structure

```
src/index.js        — All bot logic (single-file worker)
wrangler.jsonc      — Worker config (name, KV bindings, compatibility date)
vitest.config.js    — Test config (uses Cloudflare Workers pool)
test/index.spec.js  — Tests
docs/               — Documentation
  todo.md           — Implementation roadmap
  usage.md          — This file
.dev.vars           — Local dev secrets (not committed)
```

### How the Code Is Organized (`src/index.js`)

The bot is a single Cloudflare Worker with this flow:

```
Request → handleRequest()
  ├── GET /qrcode?url=...  → External QR API → PNG response
  ├── POST /webhook        → Parse Telegram update → handleUpdate()
  ├── GET /{shortCode}     → KV lookup → 301 redirect
  └── GET /                → Default text response
```

`handleUpdate()` processes Telegram messages:
- Multi-step state machine via `userStates[chatId]` (in-memory, resets on deploy)
- User preferences via `userPreferences[chatId]` (in-memory, resets on deploy)
- URL shortening stores in KV: `shorturl.put(code, originalUrl)`

### Key Globals (injected by Cloudflare Workers runtime)

| Global | Type | Description |
|--------|------|-------------|
| `BOT_TOKEN` | Secret | Telegram bot token |
| `GOOGLE_API_KEY` | Secret | Google Safe Browsing API key |
| `shorturl` | KV Namespace | Key-value store for shortened URLs |

These are available as bare globals (not `env.X`) because the worker uses the `addEventListener('fetch', ...)` pattern.

## KV Data

Currently, KV stores simple `shortCode → originalUrl` mappings.

### Inspecting KV data

```bash
# List all keys
bunx wrangler kv key list --namespace-id 3c6839a007c54764890e3c1474efe6b4

# Read a specific key
bunx wrangler kv key get --namespace-id 3c6839a007c54764890e3c1474efe6b4 "SOME_SHORT_CODE"

# Write a key manually
bunx wrangler kv key put --namespace-id 3c6839a007c54764890e3c1474efe6b4 "testcode" "https://example.com"

# Delete a key
bunx wrangler kv key delete --namespace-id 3c6839a007c54764890e3c1474efe6b4 "testcode"
```

## Debugging

### Check webhook status

```bash
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo" | jq .
```

Look for:
- `url` — should match your worker/ngrok URL + `/webhook`
- `pending_update_count` — if > 0, messages are queued (worker might be failing)
- `last_error_message` — shows the last error Telegram received

### Tail worker logs (production)

```bash
wrangler tail --format pretty
```

Shows real-time `console.log`/`console.error` output from the deployed worker.

### Common issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Bot doesn't respond | Webhook URL wrong or not set | Re-set webhook with correct URL |
| 500 errors in worker logs | `BOT_TOKEN` secret not set | `echo "token" \| bunx wrangler secret put BOT_TOKEN` |
| QR code generation fails | `qr-code-styling` canvas issue in Workers | Falls back to basic QR automatically |
| "pending_update_count" keeps growing | Worker is throwing unhandled errors | Check `wrangler tail` for the error |
| KV returns null | Wrong namespace ID in wrangler.jsonc | Verify ID matches `bunx wrangler kv namespace list` |
| Webhook works in dev but not prod | Still pointing to ngrok URL | Re-set webhook to production URL |
| Preferences reset after deploy | Stored in-memory, not KV | Expected behavior (will be fixed with KV-backed prefs) |

### Verify everything is working

```bash
# 1. Check Cloudflare auth
bunx wrangler whoami

# 2. Check secrets are set
bunx wrangler secret list

# 3. Check KV namespace exists
bunx wrangler kv namespace list

# 4. Check bot token is valid
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getMe" | jq .

# 5. Check webhook is set
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo" | jq .

# 6. Check worker is reachable
curl "https://urltools.YOUR_SUBDOMAIN.workers.dev/"
```

## Running Tests

```bash
bun test
```

Uses Vitest with `@cloudflare/vitest-pool-workers` — tests run in a simulated Workers environment.

## Useful Telegram Bot API Calls

```bash
# Delete webhook (stop receiving updates)
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook"

# Get bot info
curl -s "https://api.telegram.org/botYOUR_BOT_TOKEN/getMe" | jq .

# Send a test message (replace CHAT_ID)
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id": CHAT_ID, "text": "Hello from curl!"}'

# Set bot commands menu (what users see in Telegram)
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"commands": [
    {"command": "start", "description": "Welcome message"},
    {"command": "help", "description": "Show all commands"},
    {"command": "qrcode", "description": "Generate a QR code"},
    {"command": "checkurl", "description": "Check URL safety"},
    {"command": "qrstyle", "description": "Set QR code style"},
    {"command": "qrcolor", "description": "Set QR color scheme"},
    {"command": "qrsettings", "description": "View QR settings"},
    {"command": "qrpreview", "description": "Preview all QR styles"}
  ]}'
```

## Workflow Summary

1. **Make changes** in `src/index.js`
2. **Test locally** with `bun run dev` + ngrok
3. **Run tests** with `bun test`
4. **Deploy** with `bun run deploy`
5. **Re-set webhook** to production URL if you were testing locally
6. **Monitor** with `wrangler tail --format pretty`
