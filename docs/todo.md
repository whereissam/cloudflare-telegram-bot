# Implementation Roadmap

## Priority Tiers

### P0 — Must Have (Hackathon Core)
These 3 features transform the bot from "utility" to "product."

### P1 — Should Have
High-value additions that strengthen the demo.

### P2 — Nice to Have
Polish and advanced features for post-hackathon.

---

## P0: Link-in-Bio Mini Pages

The single biggest value jump. Users now *build something*, not just shorten.

### Commands
- [ ] `/bio` — interactive flow to create a mini landing page
- [ ] `/edit <code>` — update title, description, buttons, image
- [ ] `/delete <code>` — remove a link or bio page

### KV Schema
```
link:{code} → {
  type: "redirect" | "page",
  url: "...",                    // for redirect type
  page: {                        // for page type
    title: "...",
    description: "...",
    buttons: [{ label, url }],
    imageUrl: "...",
    theme: "default"
  },
  createdBy: chatId,
  createdAt: timestamp,
  expiresAt: timestamp | null,
  passwordHash: string | null
}
```

### Tasks
- [ ] Extend KV data model to support `type: "page"`
- [ ] Build `/bio` command — multi-step flow collecting title, description, links
- [ ] Build `/edit <code>` command — modify existing page fields
- [ ] Build `/delete <code>` command
- [ ] Create HTML renderer for bio pages at `GET /bio/{code}`
  - Clean, mobile-first design
  - Render title, description, button list
  - Minimal CSS, no external dependencies
- [ ] Add inline keyboard to bio creation flow (confirm / edit / cancel)
- [ ] Validate ownership (only creator can edit/delete)

---

## P0: Analytics Dashboard

Creator-grade stats that make users want to share and track.

### Commands
- [ ] `/stats <code>` — per-link analytics
- [ ] `/toplinks` — user's top 5 links by clicks
- [ ] `/export <code>` — download stats as CSV

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
- [ ] Write click tracking middleware in redirect handler
  - Increment `stats:{code}:{YYYYMMDD}` counters
  - Hash IP+UA for unique visitor approximation
  - Parse `Referer` header for referrer tracking
  - Use CF-IPCountry header for country tracking
  - Detect `?src=qr` param for QR scan counting
- [ ] Build `/stats <code>` response
  - Total clicks (sum across days)
  - Unique visitors
  - Top 3 referrers
  - Top 3 countries
  - Last 24h mini summary
- [ ] Build `/toplinks` — aggregate across user's links, sort by clicks
- [ ] Build `/export <code>` — generate CSV text, send as document
- [ ] Auto-append `?src=qr` to QR code URLs for scan tracking

---

## P0: Inline Keyboard UX

Replace text-based commands with tap-friendly buttons. This alone makes judges go "oh nice."

### Tasks
- [ ] After shortening a URL, reply with inline keyboard:
  - `[Copy Link] [QR Code] [Stats] [Edit] [Expire]`
- [ ] Implement callback query handler for inline button actions
- [ ] Convert `/qrstyle` to inline button picker (square / rounded / dots)
- [ ] Convert `/qrcolor` to inline button picker (8 color options)
- [ ] Add "Back" navigation buttons to multi-step flows
- [ ] After `/bio` creation, show: `[View Page] [Edit] [Stats] [Share]`
- [ ] `/help` — show command categories as buttons, expand on tap

---

## P1: Smart Link Previews

Make the bot feel like a product, not a script.

### Tasks
- [ ] When shortening a URL, fetch page metadata (title, description, favicon)
  - Use `fetch()` with timeout, parse `<title>`, `og:title`, `og:description`, `og:image`
  - Store metadata in KV alongside the link
- [ ] Display rich response after shortening:
  - Title + domain + safety status
  - Inline buttons: `[Open] [QR] [Stats]`
- [ ] Cache fetched metadata in KV (avoid re-fetching)
- [ ] Handle fetch failures gracefully (still shorten, just skip metadata)
- [ ] Optional: generate OG image via Worker (SVG → PNG) for short link previews

---

## P1: Advanced Safety / Phishing Heuristics

Turn "URL check" into an actual differentiator with explainable results.

### Checks to Implement
- [ ] Punycode / homoglyph detection (e.g., `gооgle.com` with Cyrillic o)
- [ ] Lookalike domain detection (edit distance to popular domains)
- [ ] Suspicious TLD list (`.tk`, `.ml`, `.ga`, `.cf`, `.zip`, `.mov`)
- [ ] URL length analysis (excessively long URLs)
- [ ] Redirect chain detection (multiple hops = suspicious)
- [ ] Community blocklist lookup

### Commands
- [ ] Enhance `/checkurl` response:
  - Risk level: Safe / Suspicious / Dangerous
  - List of specific reasons (bullet points)
  - Google Safe Browsing result
  - Heuristic results
- [ ] `/report <url>` — add URL domain to community blocklist in KV
  - Store: `blocklist:{domain} → { reportedBy, reportedAt, reason }`
  - Rate limit: max 10 reports per user per day

### Tasks
- [ ] Build `analyzeUrl(url)` utility returning `{ level, reasons[] }`
- [ ] Integrate heuristics into existing URL safety check flow
- [ ] Build `/report` command with rate limiting
- [ ] Cache Safe Browsing results in KV (with TTL via `expirationTtl`)

---

## P1: Expiring & One-Time Links

Security + monetization angle. Simple to implement, high perceived value.

### Commands
- [ ] `/expire <code> <duration>` — set expiration on existing link
  - Duration formats: `30m`, `2h`, `7d`, `2026-03-01`
- [ ] `/onetime <url>` — create link that works exactly once

### KV Schema Additions
```
link:{code} → {
  ...existing fields,
  expiresAt: timestamp | null,
  maxClicks: number | null,    // 1 for one-time links
  currentClicks: number
}
```

### Tasks
- [ ] Add `expiresAt` and `maxClicks` to link data model
- [ ] Check expiration in redirect handler (return 410 Gone if expired)
- [ ] Check click count in redirect handler (return 410 if maxClicks reached)
- [ ] Build `/expire` command — parse duration, update KV
- [ ] Build `/onetime` command — create link with `maxClicks: 1`
- [ ] Optional: password-protected redirect page
  - Simple HTML form that POSTs password
  - Worker validates hash, sets cookie, redirects
- [ ] Show expiration status in `/stats` output

---

## P2: Team / Workspace Mode

Sticky feature for group chats. Simple but adds retention.

### Commands
- [ ] `/workspace` — view workspace info (members, link count)
- [ ] `/workspace_stats` — aggregated analytics for all workspace links

### KV Schema
```
workspace:{chatId} → {
  name: "...",
  admins: [userId],
  members: [userId],
  links: [code]
}
```

### Tasks
- [ ] Detect group chat context (`chat.type !== "private"`)
- [ ] Auto-create workspace when bot is added to a group
- [ ] Associate links created in group chat with workspace
- [ ] Build `/workspace` command — list members, recent links
- [ ] Build `/workspace_stats` — sum stats across all workspace links
- [ ] Permission check: only admins can delete workspace links
- [ ] Handle bot removal from group (cleanup or preserve data)

---

## Implementation Notes

### KV Key Patterns
```
link:{code}                → link/page data
stats:{code}:{YYYYMMDD}   → daily analytics
user:{chatId}              → user preferences + owned links
workspace:{chatId}         → workspace config
blocklist:{domain}         → reported domains
meta:{code}                → cached page metadata (title, description, favicon)
```

### Edge-Friendly Guidelines
- All data in KV (no external databases needed for MVP)
- Keep KV values under 25 KB (plenty for JSON payloads)
- Use `expirationTtl` for cache entries (metadata, Safe Browsing results)
- Hash IP+UA for privacy-preserving unique visitor counting
- All HTML rendering happens in the Worker (no external templates)

### QR Tracking
- Append `?src=qr&c={code}` to all QR-encoded URLs
- Detect this param in redirect handler, increment `qrScans` counter
- Strip tracking params before redirecting to original URL

### Suggested Implementation Order
1. Inline keyboard UX (quick win, improves everything)
2. Analytics tracking middleware (foundation for stats)
3. `/stats` and `/toplinks` commands
4. Link-in-bio data model + `/bio` command
5. Bio page HTML renderer
6. Expiring/one-time links
7. Smart link previews (metadata fetching)
8. Advanced safety heuristics
9. `/report` + community blocklist
10. Team/workspace mode
