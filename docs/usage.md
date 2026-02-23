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

### 1. Install dependencies

```bash
bun install
```

### 2. Login to Cloudflare

```bash
bunx wrangler login
```

### 3. Set secrets (never put these in wrangler.jsonc)

```bash
echo "YOUR_BOT_TOKEN" | bunx wrangler secret put BOT_TOKEN
```

```bash
echo "YOUR_GOOGLE_API_KEY" | bunx wrangler secret put GOOGLE_API_KEY
```

### 4. Create KV namespace (skip if already exists)

```bash
bunx wrangler kv namespace create shorturl
```

Copy the output namespace ID into `wrangler.jsonc` if it differs.

### 5. Deploy

```bash
bun run deploy
```

### 6. Find your Cloudflare Workers subdomain

After deploying, the output shows your worker URL. It looks like:

```
https://urltools.<your-subdomain>.workers.dev
```

You can also find it at https://dash.cloudflare.com → Workers & Pages → your worker.

### 7. Set Telegram webhook

**Important**: The URL must start with `bot` before your token!

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"https://urltools.<YOUR_SUBDOMAIN>.workers.dev/webhook"}'
```

Replace `<YOUR_BOT_TOKEN>` with your actual bot token and `<YOUR_SUBDOMAIN>` with your Cloudflare subdomain.

### 8. Set bot commands menu

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" -H "Content-Type: application/json" -d '{"commands":[{"command":"start","description":"Welcome & overview"},{"command":"help","description":"All commands"},{"command":"qrcode","description":"Generate styled QR code"},{"command":"qrstyle","description":"Change QR style"},{"command":"qrcolor","description":"Change QR colors"},{"command":"qrsettings","description":"View QR preferences"},{"command":"checkurl","description":"Check URL safety"},{"command":"stats","description":"Link analytics"},{"command":"toplinks","description":"Your top links"},{"command":"bio","description":"Create bio page"},{"command":"edit","description":"Edit a link or bio"},{"command":"delete","description":"Delete a link"},{"command":"expire","description":"Set link expiration"},{"command":"onetime","description":"One-time link"},{"command":"report","description":"Report suspicious URL"},{"command":"export","description":"Export stats as CSV"}]}'
```

## Local Development

### Terminal 1 — run the worker locally

```bash
bun run dev
```

### Terminal 2 — expose to the internet

```bash
ngrok http 8787
```

Note the `https://xxxxx.ngrok.io` URL from the output.

### Terminal 3 — point Telegram webhook to ngrok

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"https://xxxxx.ngrok.io/webhook"}'
```

After this, messages sent to your bot in Telegram will hit your local dev server.

### Local Dev with Secrets

For local development, create a `.dev.vars` file (already in `.gitignore`):

```
BOT_TOKEN=your-bot-token-here
GOOGLE_API_KEY=your-google-api-key-here
```

`wrangler dev` automatically reads `.dev.vars` and injects them as `env.*` bindings.

### Testing Changes Locally

The dev server auto-reloads on file changes. To test manually:

```bash
curl http://localhost:8787/
```

```bash
curl "http://localhost:8787/qrcode?url=https://example.com" -o test.png
```

Simulate a Telegram webhook message:

```bash
curl -X POST http://localhost:8787/webhook -H "Content-Type: application/json" -d '{"message":{"text":"/start","chat":{"id":123456},"from":{"id":123456}}}'
```

Simulate sending a URL to shorten:

```bash
curl -X POST http://localhost:8787/webhook -H "Content-Type: application/json" -d '{"message":{"text":"https://example.com","chat":{"id":123456},"from":{"id":123456}}}'
```

## Deploying

```bash
bun run deploy
```

After deploying, make sure the webhook points to your production URL (not ngrok):

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"https://urltools.<YOUR_SUBDOMAIN>.workers.dev/webhook"}'
```

## Project Structure

```
src/
  index.js                — ES module entry point, routing
  handlers/
    commands.js           — All /command handlers + state machine
    callbacks.js          — Inline keyboard callback query handlers
  services/
    analytics.js          — Click tracking, stats, CSV export
    bio.js                — Bio page CRUD + HTML serving
    safety.js             — Google Safe Browsing + heuristics + blocklist
    links.js              — URL shortening, redirect, expiration
    metadata.js           — OG metadata fetching + caching
  utils/
    kv.js                 — KV helpers with legacy migration
    state.js              — KV-backed user state (TTL: 1h)
    qr.js                 — QR code generation
    preferences.js        — QR style/color preferences
    keyboard.js           — Inline keyboard builders
    helpers.js            — Utility functions
  templates/
    bio-page.js           — Bio page HTML (4 themes)
    expired-page.js       — 410 Gone HTML
docs/
  todo.md                 — Implementation roadmap
  usage.md                — This file
  AI_DOCUMENTATION.md     — AI assistant reference
test/
  index.spec.js           — Tests
wrangler.jsonc            — Cloudflare Worker config
.dev.vars                 — Local dev secrets (not committed)
```

### How the Code Is Organized

The bot uses ES module format (`export default { fetch }`):

```
Request → index.js fetch()
  ├── GET /qrcode?url=...  → External QR API → PNG response
  ├── POST /webhook        → callback_query? → callbacks.js
  │                        → message?        → commands.js
  ├── GET /bio/{code}      → bio.js → HTML page
  ├── GET /{code}          → links.js → 301 redirect (tracks analytics)
  └── GET /                → Default text response
```

### Environment Bindings (via `env` parameter)

| Binding | Type | Description |
|---------|------|-------------|
| `env.BOT_TOKEN` | Secret | Telegram bot token |
| `env.GOOGLE_API_KEY` | Secret | Google Safe Browsing API key |
| `env.shorturl` | KV Namespace | All data storage |

## KV Data Model

```
link:{code}                           → link/page data (JSON)
stats:{code}:{YYYYMMDD}              → daily analytics (JSON)
pref:{chatId}                         → QR preferences (JSON)
state:{chatId}                        → user state, TTL: 1h (JSON)
user:{chatId}                         → user's owned links (JSON)
meta:{url}                            → cached page metadata, TTL: 7d (JSON)
workspace:{chatId}                    → workspace config (JSON)
blocklist:{domain}                    → reported domains (JSON)
ratelimit:report:{chatId}:{YYYYMMDD} → report count, TTL: 24h
visitor:{code}:{hash}:{YYYYMMDD}     → "1", TTL: 24h
```

### Inspecting KV data

```bash
bunx wrangler kv key list --namespace-id 3c6839a007c54764890e3c1474efe6b4
```

```bash
bunx wrangler kv key get --namespace-id 3c6839a007c54764890e3c1474efe6b4 "link:SOME_CODE"
```

```bash
bunx wrangler kv key put --namespace-id 3c6839a007c54764890e3c1474efe6b4 "testcode" "https://example.com"
```

```bash
bunx wrangler kv key delete --namespace-id 3c6839a007c54764890e3c1474efe6b4 "testcode"
```

## Debugging

### Check webhook status

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo" | jq .
```

Look for:
- `url` — should match your worker/ngrok URL + `/webhook`
- `pending_update_count` — if > 0, messages are queued (worker might be failing)
- `last_error_message` — shows the last error Telegram received

### Tail worker logs (production)

```bash
wrangler tail --format pretty
```

### Common issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Bot doesn't respond | Webhook URL wrong or not set | Re-set webhook with correct URL |
| 404 from Telegram API | Missing `bot` prefix in URL | URL must be `https://api.telegram.org/bot<TOKEN>/...` |
| "Malformed input" curl errors | Multi-line curl with bad line breaks | Use single-line curl commands |
| 500 errors in worker logs | `BOT_TOKEN` secret not set | Run `echo "token" \| bunx wrangler secret put BOT_TOKEN` |
| KV returns null | Wrong namespace ID in wrangler.jsonc | Verify with `bunx wrangler kv namespace list` |
| Webhook works in dev but not prod | Still pointing to ngrok URL | Re-set webhook to production URL |

### Verify everything is working

```bash
bunx wrangler whoami
```

```bash
bunx wrangler secret list
```

```bash
bunx wrangler kv namespace list
```

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe" | jq .
```

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo" | jq .
```

```bash
curl "https://urltools.<YOUR_SUBDOMAIN>.workers.dev/"
```

## Useful Telegram Bot API Calls

Delete webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

Get bot info:

```bash
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe" | jq .
```

Send a test message:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage" -H "Content-Type: application/json" -d '{"chat_id":CHAT_ID,"text":"Hello from curl!"}'
```

## Workflow Summary

1. **Make changes** in `src/`
2. **Test locally** with `bun run dev` + ngrok
3. **Run tests** with `bun test`
4. **Deploy** with `bun run deploy`
5. **Re-set webhook** to production URL if you were testing locally
6. **Monitor** with `wrangler tail --format pretty`
