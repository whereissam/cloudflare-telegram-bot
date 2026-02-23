# Implementation Roadmap

## Priority Tiers

### P0 — Must Have 
These 3 features transform the bot from "utility" to "product."

### P1 — Should Have
High-value additions that strengthen the demo.

### P2 — Nice to Have
Polish and advanced features for post-hackathon.

---

## P0: Link-in-Bio Mini Pages

The single biggest value jump. Users now *build something*, not just shorten.

### Commands
- [x] `/bio` — interactive flow to create a mini landing page
- [x] `/edit <code>` — update title, description, buttons, image
- [x] `/delete <code>` — remove a link or bio page

### KV Schema
```
link:{code} → {
  type: "redirect" | "page",
  url: "...",                    // for redirect type
  page: {                        // for page type
    title: "...",
    description: "...",
    buttons: [{ label, url }],
    theme: "light"
  },
  createdBy: chatId,
  createdAt: timestamp,
  expiresAt: timestamp | null,
  maxClicks: number | null,
  currentClicks: number
}
```

### Tasks
- [x] Extend KV data model to support `type: "page"`
- [x] Build `/bio` command — multi-step flow collecting title, description, links
- [x] Build `/edit <code>` command — modify existing page fields
- [x] Build `/delete <code>` command
- [x] Create HTML renderer for bio pages at `GET /bio/{code}`
  - Clean, mobile-first design
  - Render title, description, button list
  - Minimal CSS, no external dependencies
- [x] Add inline keyboard to bio creation flow (confirm / edit / cancel)
- [x] Validate ownership (only creator can edit/delete)

---

## P0: Analytics Dashboard

Creator-grade stats that make users want to share and track.

### Commands
- [x] `/stats <code>` — per-link analytics
- [x] `/toplinks` — user's top 5 links by clicks
- [x] `/export <code>` — download stats as CSV

### KV Schema
```
stats:{code}:{YYYYMMDD} → {
  clicks: number,
  uniques: number,         // hashed IP+UA dedup
  referrers: { domain: count },
  countries: { code: count },
  qrScans: number
}
```

### Tasks
- [x] Write click tracking middleware in redirect handler
  - Increment `stats:{code}:{YYYYMMDD}` counters
  - Hash IP+UA for unique visitor approximation
  - Parse `Referer` header for referrer tracking
  - Use CF-IPCountry header for country tracking
  - Detect `?src=qr` param for QR scan counting
- [x] Build `/stats <code>` response
  - Total clicks (sum across days)
  - Unique visitors
  - Top 3 referrers
  - Top 3 countries
  - Last 7 days bar chart
- [x] Build `/toplinks` — aggregate across user's links, sort by clicks
- [x] Build `/export <code>` — generate CSV text, send as document
- [x] Auto-append `?src=qr` to QR code URLs for scan tracking

---

## P0: Inline Keyboard UX

Replace text-based commands with tap-friendly buttons. This alone makes judges go "oh nice."

### Tasks
- [x] After shortening a URL, reply with inline keyboard:
  - `[QR Code] [Stats] [Expire] [Open Link]`
- [x] Implement callback query handler for inline button actions
- [x] Convert `/qrstyle` to inline button picker (square / rounded / dots)
- [x] Convert `/qrcolor` to inline button picker (8 color options)
- [x] Add "Back" navigation buttons to multi-step flows
- [x] After `/bio` creation, show: `[View Page] [Edit] [Stats] [Share]`
- [x] `/help` — show command categories as buttons, expand on tap

---

## P1: Smart Link Previews

Make the bot feel like a product, not a script.

### Tasks
- [x] When shortening a URL, fetch page metadata (title, description, favicon)
  - Use `fetch()` with timeout, parse `<title>`, `og:title`, `og:description`, `og:image`
  - Store metadata in KV alongside the link
- [x] Display rich response after shortening:
  - Title + domain + safety status
  - Inline buttons: `[QR] [Stats] [Expire] [Open]`
- [x] Cache fetched metadata in KV (avoid re-fetching)
- [x] Handle fetch failures gracefully (still shorten, just skip metadata)

---

## P1: Advanced Safety / Phishing Heuristics

Turn "URL check" into an actual differentiator with explainable results.

### Checks Implemented
- [x] Punycode / homoglyph detection (e.g., `gооgle.com` with Cyrillic o)
- [x] Lookalike domain detection (edit distance to popular domains)
- [x] Suspicious TLD list (`.tk`, `.ml`, `.ga`, `.cf`, `.zip`, `.mov`)
- [x] URL length analysis (excessively long URLs)
- [x] Excessive subdomains detection
- [x] IP hostname detection
- [x] @ credential trick detection
- [x] Community blocklist lookup

### Commands
- [x] Enhance `/checkurl` response:
  - Risk level: Safe / Suspicious / Dangerous
  - List of specific reasons (bullet points)
  - Google Safe Browsing result
  - Heuristic results
- [x] `/report <url>` — add URL domain to community blocklist in KV
  - Store: `blocklist:{domain} → { reportedBy, reportedAt, reportCount }`
  - Rate limit: max 10 reports per user per day

### Tasks
- [x] Build `analyzeUrl(url)` utility returning `{ level, reasons[] }`
- [x] Integrate heuristics into existing URL safety check flow
- [x] Build `/report` command with rate limiting

---

## P1: Expiring & One-Time Links

Security + monetization angle. Simple to implement, high perceived value.

### Commands
- [x] `/expire <code> <duration>` — set expiration on existing link
  - Duration formats: `30m`, `2h`, `7d`, `2026-03-01`
- [x] `/onetime <url>` — create link that works exactly once

### Tasks
- [x] Add `expiresAt` and `maxClicks` to link data model
- [x] Check expiration in redirect handler (return 410 Gone if expired)
- [x] Check click count in redirect handler (return 410 if maxClicks reached)
- [x] Build `/expire` command — parse duration, update KV
- [x] Build `/onetime` command — create link with `maxClicks: 1`
- [x] Show expiration status in `/stats` output

---

## P2: Team / Workspace Mode

Sticky feature for group chats. Simple but adds retention.

### Commands
- [x] `/workspace` — view workspace info (members, link count)
- [x] `/workspace_stats` — aggregated analytics for all workspace links

### Tasks
- [x] Detect group chat context (`chat.type !== "private"`)
- [x] Auto-create workspace when bot is used in a group
- [x] Associate links created in group chat with workspace
- [x] Build `/workspace` command — list members, link count
- [x] Build `/workspace_stats` — sum stats across all workspace links

---

## Implementation Notes

### KV Key Patterns
```
link:{code}                → link/page data
stats:{code}:{YYYYMMDD}   → daily analytics
pref:{chatId}              → QR preferences
state:{chatId}             → user state (TTL: 1h)
user:{chatId}              → user's owned links
workspace:{chatId}         → workspace config
blocklist:{domain}         → reported domains
meta:{url}                 → cached page metadata (TTL: 7d)
visitor:{code}:{hash}:{YYYYMMDD} → unique visitor dedup (TTL: 24h)
ratelimit:report:{chatId}:{YYYYMMDD} → report rate limit (TTL: 24h)
```

### Architecture
- ES module format (`export default { fetch }`)
- Multi-file structure under `src/`
- `env` parameter passed to all functions (no global bindings)
- KV-backed user state (replaces in-memory `userStates`)
- Legacy link migration: `getLink()` reads `link:{code}` first, falls back to bare `{code}` key
- Non-blocking analytics via `ctx.waitUntil()`
