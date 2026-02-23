# AI Documentation - Cloudflare Telegram Bot Project

This documentation is designed for AI assistants to understand the codebase structure, functionality, and development context.

## Project Overview

A **Telegram Link Hub Bot** deployed on Cloudflare Workers. Features URL shortening, link-in-bio pages, click analytics, styled QR codes, URL safety checking with heuristics, expiring/one-time links, and team workspaces.

## Project Structure

```
cloudflare-telegram-bot/
├── src/
│   ├── index.js                    # ES module entry point, routing
│   ├── handlers/
│   │   ├── commands.js             # All /command handlers + state machine
│   │   └── callbacks.js            # Inline keyboard callback query handlers
│   ├── services/
│   │   ├── analytics.js            # Click tracking, stats aggregation, CSV export
│   │   ├── bio.js                  # Bio page CRUD + HTML serving
│   │   ├── safety.js               # Google Safe Browsing + heuristics + blocklist
│   │   ├── links.js                # URL shortening, redirect with expiration checks
│   │   └── metadata.js             # OG metadata fetching + KV caching
│   ├── utils/
│   │   ├── kv.js                   # KV helpers, getLink with legacy migration
│   │   ├── state.js                # KV-backed user state management (TTL: 1h)
│   │   ├── qr.js                   # QR code generation via external API
│   │   ├── preferences.js          # QR style/color preferences + constants
│   │   ├── keyboard.js             # Inline keyboard builders
│   │   └── helpers.js              # isValidUrl, generateShortCode, escapeHtml, parseDuration
│   └── templates/
│       ├── bio-page.js             # Bio page HTML (4 themes: light/dark/gradient/minimal)
│       └── expired-page.js         # 410 Gone HTML template
├── docs/
│   ├── todo.md                     # Implementation roadmap (all completed)
│   └── AI_DOCUMENTATION.md         # This file
├── test/
│   └── index.spec.js               # Test files
├── package.json
├── wrangler.jsonc                   # Cloudflare Worker config
├── vitest.config.js
└── README.md
```

## Technology Stack
- **Runtime**: Cloudflare Workers (ES module format)
- **Language**: JavaScript (ES modules)
- **Telegram**: telegram-webhook-js library
- **QR Generation**: External API (api.qrserver.com)
- **Storage**: Cloudflare KV (Key-Value store)
- **Safety**: Google Safe Browsing API + custom heuristics
- **Testing**: Vitest with Cloudflare Workers pool

## Architecture

### Entry Point (`src/index.js`)

Uses `export default { fetch(request, env, ctx) }` format. Routes:
- `POST /webhook` → Telegram webhook handler
- `GET /qrcode?url=` → QR code image proxy
- `GET /bio/{code}` → Bio page HTML
- `GET /{code}` → Short URL redirect (with analytics tracking)

### Environment Bindings

All accessed via `env` parameter (no globals):
- `env.BOT_TOKEN` — Telegram bot token (secret)
- `env.GOOGLE_API_KEY` — Google Safe Browsing API key (secret)
- `env.shorturl` — KV namespace binding

### KV Data Model

```
link:{code}                           → { type, url, page?, createdBy, createdAt, expiresAt?, maxClicks?, currentClicks }
stats:{code}:{YYYYMMDD}              → { clicks, uniques, referrers:{}, countries:{}, qrScans }
pref:{chatId}                         → { style, colorScheme }
state:{chatId}                        → { waitingFor, ...data }  (TTL: 1h)
user:{chatId}                         → { links: [code, ...] }
meta:{url}                            → { title, description, image, domain, fetchedAt }  (TTL: 7d)
workspace:{chatId}                    → { name, admins, members, links }
blocklist:{domain}                    → { reportedBy, reportedAt, reportCount }
ratelimit:report:{chatId}:{YYYYMMDD} → count  (TTL: 24h)
visitor:{code}:{hash}:{YYYYMMDD}     → "1"  (TTL: 24h)
```

**Legacy migration**: `getLink()` in `utils/kv.js` reads `link:{code}` first, falls back to bare `{code}` key (plain URL string from v1), and lazy-migrates on access.

### Request Flow

```
Telegram → POST /webhook → index.js
  ├── callback_query? → handlers/callbacks.js → handleCallback()
  └── message? → handlers/commands.js → handleMessage()
       ├── Has state? → handleState() (multi-step flow)
       ├── Is command? → switch(cmd) → specific handler
       └── Is URL? → shortenUrl() (with safety + metadata)

Browser → GET /{code} → services/links.js → handleRedirect()
  ├── Check expiration/maxClicks → 410 if expired
  ├── ctx.waitUntil(trackClick()) → analytics
  └── 301 redirect

Browser → GET /bio/{code} → services/bio.js → serveBioPage()
  ├── ctx.waitUntil(trackClick()) → analytics
  └── HTML response from templates/bio-page.js
```

### State Management

User states are stored in KV (`state:{chatId}`) with 1-hour TTL:
- `qr_url` — waiting for URL to generate QR code
- `check_url` — waiting for URL to check safety
- `bio_title` → `bio_description` → `bio_links` — multi-step bio creation
- `edit_url`, `edit_bio_title`, `edit_bio_desc`, `edit_bio_addlink`, `edit_bio_rmlink` — edit flows
- `expire_input` — waiting for expiration duration

### Safety System (`services/safety.js`)

Three layers:
1. **Google Safe Browsing API**: Checks MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE, POTENTIALLY_HARMFUL_APPLICATION
2. **Heuristic analysis** (`analyzeUrl()`): Punycode, lookalike domains (Levenshtein ≤2), suspicious TLDs, URL length, excessive subdomains, IP hostnames, @ tricks
3. **Community blocklist**: Domain flagged at ≥3 reports

Returns `{ level: 'safe'|'suspicious'|'dangerous', reasons: [] }`.

- `dangerous` URLs are blocked from shortening
- `suspicious` URLs show a warning with [Shorten Anyway] / [Cancel] buttons

### Analytics (`services/analytics.js`)

`trackClick()` runs non-blocking via `ctx.waitUntil()`:
- Increments daily stats (`stats:{code}:{YYYYMMDD}`)
- Tracks referrer (Referer header), country (CF-IPCountry header)
- Deduplicates unique visitors via SHA-256 hash of IP+UA
- Detects QR scans via `?src=qr` parameter
- Increments `currentClicks` on link data

### Inline Keyboards (`utils/keyboard.js`)

Key keyboards:
- `shortLinkKeyboard(code, shortUrl)` — [QR Code] [Stats] [Expire] [Open Link]
- `bioKeyboard(code, pageUrl)` — [View Page] [Edit] [Stats] [Share]
- `qrStyleKeyboard()` — Style picker buttons
- `qrColorKeyboard()` — Color scheme buttons (2 per row)
- `helpKeyboard()` — Command categories
- `editBioKeyboard(code)` — [Edit Title] [Edit Description] [Add Link] [Remove Link] [Delete]
- `expireKeyboard(code)` — Duration presets
- `confirmDeleteKeyboard(code)` — [Yes, Delete] [Cancel]

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome + feature overview |
| `/help` | Categories via inline keyboard |
| `/qrcode [url]` | Generate styled QR code |
| `/qrstyle` | QR style picker (inline buttons) |
| `/qrcolor` | QR color picker (inline buttons) |
| `/qrsettings` | View current QR preferences |
| `/qrpreview` | Preview all QR styles |
| `/checkurl [url]` | URL safety report |
| `/stats <code>` | Link analytics |
| `/toplinks` | Top 5 links by clicks |
| `/export <code>` | CSV stats export |
| `/bio` | Create bio page (multi-step) |
| `/edit <code>` | Edit link or bio page |
| `/delete <code>` | Delete with confirmation |
| `/expire <code> <duration>` | Set expiration |
| `/onetime <url>` | One-time link |
| `/report <url>` | Report to blocklist |
| `/workspace` | Workspace info (groups) |
| `/workspace_stats` | Workspace analytics (groups) |

## Development Guidelines

### Adding New Commands
1. Add handler function in `src/handlers/commands.js`
2. Add case in the `switch(cmd)` block in `handleMessage()`
3. If multi-step, add state handling in `handleState()`
4. Update help text in callbacks.js helpTexts
5. Update README.md

### Adding New Inline Keyboard Actions
1. Add keyboard builder in `src/utils/keyboard.js`
2. Add callback handler in `src/handlers/callbacks.js` `handleCallback()`

### Key Patterns
- All functions receive `env` as parameter — never access global bindings
- Use `ctx.waitUntil()` for non-blocking work (analytics, workspace tracking)
- Inline keyboards use `callback_data` for bot actions, `url` for external links
- Multi-step flows store state in KV with 1h TTL
- Legacy links (plain URL strings) are auto-migrated on first access
