# Telegram Link Hub Bot

A Telegram bot that goes beyond URL shortening — create link-in-bio pages, track analytics, generate styled QR codes, and verify URL safety. All running on the edge with Cloudflare Workers.

## Features

### Core
- **URL Shortening**: Send any URL to instantly shorten it with inline keyboard actions
- **Advanced QR Codes**: 3 styles, 8 color schemes, persistent preferences per user
- **URL Safety**: Google Safe Browsing API + custom phishing heuristics with explainable risk reports

### Link-in-Bio Pages
- **Create landing pages**: Build link-in-bio pages via guided `/bio` flow
- **4 themes**: Light, dark, gradient, minimal — mobile-first HTML with OG tags
- **Editable**: Update title, description, add/remove links via inline keyboards

### Analytics Dashboard
- **Click tracking**: Total clicks, unique visitors (SHA-256 hashed IP+UA), referrers, countries
- **QR scan tracking**: Auto-appended `?src=qr` parameter for scan detection
- **Bar chart**: 7-day sparkline in stats output
- **CSV export**: Download per-link stats via `/export`

### Smart Link Previews
- **Auto metadata**: Fetches og:title, og:description, og:image on shortening
- **Rich response**: Title + domain + description + safety status + inline buttons
- **Cached**: Metadata stored in KV with 7-day TTL

### Advanced Safety
- **Heuristic analysis**: Punycode detection, lookalike domains (Levenshtein distance), suspicious TLDs, IP hostnames, excessive subdomains, @ tricks, URL length
- **Community blocklist**: `/report` to flag domains, auto-flagged at 3+ reports
- **Rate limited**: 10 reports per user per day

### Expiring & One-Time Links
- **Time-based expiration**: `/expire <code> 2h` or `/expire <code> 2026-03-01`
- **One-time links**: `/onetime <url>` — self-destructs after one click
- **410 Gone page**: Styled HTML page for expired/used links

### Inline Keyboard UX
- **Post-shorten actions**: [QR Code] [Stats] [Expire] [Open Link]
- **Button pickers**: Style and color selection via inline keyboards
- **Help categories**: Tap-to-expand command categories
- **Bio actions**: [View Page] [Edit] [Stats] [Share]

### Team / Workspace Mode
- **Group chat workspaces**: Auto-created when bot is used in groups
- **Shared links**: Links created in groups are tracked per workspace
- **Workspace stats**: Aggregated analytics across all workspace links

## Commands

### Basic
- `/start` — Welcome message and feature overview
- `/help` — Command categories via inline keyboard

### URL Operations
- Send any URL — Shorten it with smart preview
- `/qrcode [url]` — Generate styled QR code
- `/checkurl [url]` — URL safety report with risk level
- `/report <url>` — Report suspicious URL to community blocklist

### Link-in-Bio
- `/bio` — Interactive flow to create a bio page
- `/edit <code>` — Edit a link or bio page
- `/delete <code>` — Delete with confirmation

### Analytics
- `/stats <code>` — Click analytics with bar chart
- `/toplinks` — Your top 5 links by clicks
- `/export <code>` — Download stats as CSV

### QR Code Customization
- `/qrstyle` — Choose style via inline buttons
- `/qrcolor` — Choose color scheme via inline buttons
- `/qrsettings` — View current QR preferences
- `/qrpreview` — Preview all styles

### Link Management
- `/expire <code> <duration>` — Set expiration (30m, 2h, 7d, or ISO date)
- `/onetime <url>` — Create a one-time self-destructing link

### Workspace (Group Chats)
- `/workspace` — View workspace info
- `/workspace_stats` — Aggregated analytics

## Architecture

### Project Structure
```
src/
  index.js                — ES module entry point, routing
  handlers/
    commands.js           — All /command handlers
    callbacks.js          — Callback query (inline keyboard) handlers
  services/
    analytics.js          — Click tracking, stats aggregation, CSV export
    bio.js                — Bio page CRUD + serving
    safety.js             — Google Safe Browsing + heuristics + blocklist
    links.js              — URL shortening, redirect with expiration
    metadata.js           — OG metadata fetching + caching
  utils/
    kv.js                 — KV helpers with legacy migration
    state.js              — KV-backed user state (replaces in-memory)
    qr.js                 — QR code generation
    preferences.js        — User QR preferences
    keyboard.js           — Inline keyboard builders
    helpers.js            — isValidUrl, generateShortCode, escapeHtml, parseDuration
  templates/
    bio-page.js           — Bio page HTML (4 themes)
    expired-page.js       — 410 Gone HTML
```

### KV Data Model
```
link:{code}                           → { type, url, page?, createdBy, createdAt, expiresAt?, maxClicks?, currentClicks }
stats:{code}:{YYYYMMDD}              → { clicks, uniques, referrers, countries, qrScans }
pref:{chatId}                         → { style, colorScheme }
state:{chatId}                        → { waitingFor, ...data }  (TTL: 1h)
user:{chatId}                         → { links: [code, ...] }
meta:{url}                            → { title, description, image, domain, fetchedAt }  (TTL: 7d)
workspace:{chatId}                    → { name, admins, members, links }
blocklist:{domain}                    → { reportedBy, reportedAt, reportCount }
ratelimit:report:{chatId}:{YYYYMMDD} → count  (TTL: 24h)
visitor:{code}:{hash}:{YYYYMMDD}     → "1"  (TTL: 24h)
```

### API Endpoints
- `POST /webhook` — Telegram webhook
- `GET /qrcode?url=<url>` — QR code image (PNG)
- `GET /bio/{code}` — Bio page HTML
- `GET /{code}` — Short URL redirect (301, tracks analytics)

## Setup

### Prerequisites
- Cloudflare account
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Google Safe Browsing API Key
- Bun (runtime & package manager)

### Installation

```bash
git clone <your-repo-url>
cd cloudflare-telegram-bot
bun install
```

### Configure Secrets
```bash
echo "your-bot-token" | bunx wrangler secret put BOT_TOKEN
echo "your-google-api-key" | bunx wrangler secret put GOOGLE_API_KEY
```

### Deploy
```bash
bun run deploy
```

### Set Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-worker-domain.workers.dev/webhook"}'
```

## Development

```bash
bun run dev          # Start local dev server
bun run deploy       # Deploy to Cloudflare Workers
bun test             # Run tests
```

## License

MIT
