# Telegram Link Hub Bot

A Telegram bot that goes beyond URL shortening — create link-in-bio pages, track analytics, generate styled QR codes, and verify URL safety. All running on the edge with Cloudflare Workers.

## Features

### Core
- **URL Shortening**: Convert long URLs into short, shareable links
- **Advanced QR Code Generation**: Styled QR codes with 3 styles, 8 color schemes, and persistent user preferences
- **URL Safety Check**: Verify URLs using Google Safe Browsing API + custom phishing heuristics

### Link-in-Bio Mini Pages
- **Create landing pages**: Build lightweight link-in-bio pages (like Linktree) right from Telegram
- **Customizable**: Title, description, multiple buttons, preview image, expiration
- **Editable**: Update your pages anytime via bot commands

### Analytics Dashboard
- **Click tracking**: Total clicks, unique visitors (hashed IP+UA), top referrers, top countries
- **QR scan tracking**: Automatic `?src=qr` parameter to distinguish QR scans from direct clicks
- **Per-link stats**: Sparkline-style summaries for last 24h activity
- **Export**: Download stats as CSV

### Smart Link Previews
- **Metadata extraction**: Auto-fetch title, site name, favicon when shortening
- **Rich Telegram cards**: Display link info with domain, risk status, and action buttons
- **OG image generation**: Professional-looking previews for shared short links

### Advanced Safety
- **Explainable risk scoring**: Beyond binary safe/unsafe — see *why* a URL is flagged
- **Phishing heuristics**: Punycode detection, lookalike domains, suspicious TLDs, URL length analysis
- **Community reporting**: Submit suspicious links to a shared blocklist

### Expiring & One-Time Links
- **Time-based expiration**: Links that auto-expire after a set duration or date
- **One-time links**: Self-destructing links that work exactly once
- **Password protection**: Optional password gate before redirect

### Inline Keyboard UX
- **One-tap actions**: After shortening — [Copy] [QR] [Stats] [Edit] [Expire]
- **Button pickers**: Style and color selection via inline keyboards instead of text commands
- **Navigation**: Back buttons and flow-based interactions

### Team / Workspace Mode
- **Group chat workspaces**: Shared link pools per Telegram group
- **Roles**: Admin and member permissions
- **Workspace analytics**: Aggregated stats across all team links

## Commands

### Basic
- `/start` - Welcome message and feature overview
- `/help` - Complete command reference and usage tips

### URL Operations
- `/shorten [url]` - Shorten a URL (or send any URL directly)
- `/qrcode [url]` - Generate a styled QR code
- `/checkurl [url]` - Check URL safety with detailed risk report

### Link-in-Bio
- `/bio` - Create a new link-in-bio page
- `/edit <code>` - Edit a short link or bio page (title, description, buttons)
- `/delete <code>` - Delete a short link or bio page

### Analytics
- `/stats <code>` - View click analytics for a link
- `/toplinks` - Your top 5 performing links
- `/export <code>` - Export analytics as CSV

### QR Code Customization
- `/qrstyle` - Choose QR code style (square / rounded / dots)
- `/qrcolor` - Select color scheme (8 options)
- `/qrsettings` - View current QR preferences
- `/qrpreview` - Preview all available styles

### Link Management
- `/expire <code> <duration>` - Set expiration (e.g., `2h`, `7d`, `2026-03-01`)
- `/onetime <url>` - Create a one-time self-destructing link
- `/report <url>` - Report a suspicious URL to the community blocklist

### Workspace (Group Chats)
- `/workspace` - View workspace info and shared links
- `/workspace_stats` - Aggregated analytics for all workspace links

## Setup

### Prerequisites

- Cloudflare account
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Google Safe Browsing API Key
- Bun (runtime & package manager)
- ngrok (for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd cloudflare-telegram-bot
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Authenticate with Cloudflare**
   ```bash
   # Option A: Browser login (recommended)
   bunx wrangler login

   # Option B: API token (if browser login fails)
   export CLOUDFLARE_API_TOKEN="your-api-token"
   ```

4. **Configure secrets (SECURE)**

   **NEVER** put API keys in `wrangler.jsonc`. Use Wrangler secrets instead:
   ```bash
   echo "your-bot-token" | bunx wrangler secret put BOT_TOKEN
   echo "your-google-api-key" | bunx wrangler secret put GOOGLE_API_KEY
   ```

5. **Set up KV namespace** (if not already created)
   ```bash
   bunx wrangler kv namespace create shorturl
   ```

   Update the namespace ID in `wrangler.jsonc` if needed.

6. **Deploy to Cloudflare**
   ```bash
   bun run deploy
   ```

7. **Set Telegram webhook**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
   -H "Content-Type: application/json" \
   -d '{"url": "https://your-worker-domain.workers.dev/webhook"}'
   ```

### Local Development

1. **Start local development server**
   ```bash
   wrangler dev
   ```

2. **In another terminal, start ngrok**
   ```bash
   ngrok http 8787
   ```

3. **Set webhook to ngrok URL**
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
   -H "Content-Type: application/json" \
   -d '{"url": "https://your-ngrok-url.ngrok.io/webhook"}'
   ```

## Configuration

### Secrets (Environment Variables)

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `BOT_TOKEN` | Your Telegram bot token from BotFather | Yes |
| `GOOGLE_API_KEY` | Google Safe Browsing API key for URL safety checks | Yes |

### KV Namespace

The bot uses Cloudflare KV for all data storage:
- Short links & bio pages
- Click analytics counters
- User preferences & workspace config
- Community blocklist

## API Endpoints

- `GET /` - Default response / landing page
- `POST /webhook` - Telegram webhook endpoint
- `GET /qrcode?url=<url>` - Generate QR code image
- `GET /bio/{code}` - Render link-in-bio page
- `GET /{shortCode}` - Redirect to original URL (tracks analytics)

## Architecture

### Data Model (KV)

```
link:{code}     → { type, url, page?, createdBy, createdAt, expiresAt?, maxClicks?, passwordHash?, meta? }
stats:{code}:{YYYYMMDD} → { clicks, uniques, referrers, countries, qrScans }
user:{chatId}   → { preferences, links[], workspace? }
workspace:{chatId} → { members[], admins[], links[] }
blocklist:{domain} → { reportedBy, reportedAt, reason }
```

### Project Structure
```
├── src/
│   └── index.js          # Main worker script
├── docs/
│   └── todo.md           # Implementation roadmap
├── test/
│   └── index.spec.js     # Test files
├── package.json          # Dependencies
├── wrangler.jsonc        # Cloudflare Worker configuration
├── vitest.config.js      # Test configuration
└── README.md             # This file
```

## Security Features

- **Google Safe Browsing API**: All URLs checked before processing
- **Phishing heuristics**: Punycode, lookalike domain, suspicious TLD detection
- **Explainable risk reports**: Users see *why* a URL was flagged
- **Community blocklist**: Crowd-sourced suspicious URL reporting
- **Malicious URL blocking**: Prevents shortening or QR code generation for harmful URLs
- **Input validation**: Strict URL parsing and sanitization

## Development

### Scripts
- `bun run dev` - Start local development server
- `bun run deploy` - Deploy to Cloudflare Workers
- `bun run start` - Alias for dev
- `bun test` - Run test suite with Vitest

### Running Tests
```bash
bun test
```

## Troubleshooting

### Common Issues

1. **Webhook not working**
   - Check if webhook URL is correct
   - Verify bot token is valid
   - Ensure webhook is set to correct endpoint
   - Check worker logs for errors

2. **KV namespace errors**
   - Verify namespace ID in wrangler.jsonc
   - Check if namespace exists in Cloudflare dashboard

3. **API key issues**
   - Verify Google Safe Browsing API key is valid
   - Check API quotas and limits

4. **Worker hanging/crashing**
   - Check if secrets are properly configured
   - Verify environment variables are accessible
   - Test worker endpoint directly

### Debug Commands

```bash
# Check webhook status
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Test bot token
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Test worker endpoint
curl "https://your-worker-domain.workers.dev/"

# Check worker logs
wrangler tail --format pretty

# List secrets
bunx wrangler secret list
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

---

Built with Cloudflare Workers and Telegram Bot API.
