# Telegram URL Shortener & QR Code Bot

A Telegram bot that provides URL shortening, QR code generation, and URL safety checking services. Built with Cloudflare Workers and deployed on the edge.

## Features

- **URL Shortening**: Convert long URLs into short, shareable links
- **QR Code Generation**: Create QR codes for any URL
- **URL Safety Check**: Verify URLs using Google Safe Browsing API
- **Edge Deployment**: Fast response times with Cloudflare Workers

## Commands

- `/start` - Start the bot and see welcome message
- `/help` - Show all available commands
- `/qrcode [url]` - Generate a QR code for a URL
- `/checkurl [url]` - Check if a URL is safe
- Send any URL directly to get a shortened version

## Setup

### Prerequisites

- Cloudflare account
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Google Safe Browsing API Key
- Node.js and npm
- ngrok (for local development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd cloudflare-telegram-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure secrets (SECURE)**
   
   **NEVER** put API keys in `wrangler.jsonc`. Use Wrangler secrets instead:
   ```bash
   # Set your bot token as a secret
   echo "your-bot-token" | wrangler secret put BOT_TOKEN
   
   # Set your Google API key as a secret  
   echo "your-google-api-key" | wrangler secret put GOOGLE_API_KEY
   ```

4. **Set up KV namespace**
   ```bash
   wrangler login
   wrangler kv namespace create shorturl
   ```
   
   Update the namespace ID in `wrangler.jsonc`.

5. **Deploy to Cloudflare**
   ```bash
   wrangler deploy
   ```

6. **Set Telegram webhook**
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

**Security Note**: These are stored as Cloudflare Workers secrets, not as plain text in config files.

### KV Namespace

The bot uses Cloudflare KV to store shortened URLs. Make sure to:
1. Create a KV namespace named `shorturl`
2. Update the namespace ID in `wrangler.jsonc`

## API Endpoints

- `GET /` - Default response page
- `POST /webhook` - Telegram webhook endpoint
- `GET /qrcode?url=<url>` - Generate QR code image
- `GET /{shortCode}` - Redirect to original URL

## Usage Examples

### URL Shortening
Send any valid URL to the bot:
```
https://example.com/very/long/url/path
```
Bot responds with shortened URL.

### QR Code Generation
```
/qrcode https://example.com
```
or
```
/qrcode
```
Then send the URL when prompted.

### URL Safety Check
```
/checkurl https://suspicious-site.com
```
or
```
/checkurl
```
Then send the URL when prompted.

## Security Features

- **URL Safety Verification**: All URLs are checked against Google Safe Browsing API
- **Malicious URL Blocking**: Prevents shortening or QR code generation for harmful URLs
- **Input Validation**: Ensures all inputs are valid URLs

## Development

### Project Structure
```
├── src/
│   └── index.js          # Main worker script
├── test/
│   └── index.spec.js     # Test files
├── package.json          # Dependencies
├── wrangler.jsonc       # Cloudflare Worker configuration
├── vitest.config.js     # Test configuration
└── README.md            # This file
```

### Running Tests
```bash
npm test
```

### Scripts
- `npm run dev` - Start local development
- `npm run deploy` - Deploy to Cloudflare
- `npm test` - Run tests

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

**Check webhook status:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Test bot token:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

**Test worker endpoint:**
```bash
curl "https://your-worker-domain.workers.dev/"
```

**Test webhook endpoint:**
```bash
curl -X POST "https://your-worker-domain.workers.dev/webhook" \
-H "Content-Type: application/json" \
-d '{"message":{"text":"/start","chat":{"id":123}}}'
```

**Check worker logs:**
```bash
wrangler tail --format pretty
```

**List secrets:**
```bash
wrangler secret list
```

**Delete webhook (for testing):**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

**Set webhook:**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
-H "Content-Type: application/json" \
-d '{"url": "https://your-worker-domain.workers.dev/webhook"}'
```

### Local Development Debug

**Start local development:**
```bash
wrangler dev --local
```

**In another terminal, test local endpoint:**
```bash
curl "http://localhost:8787/"
```

**Use ngrok for webhook testing:**
```bash
# Terminal 1
wrangler dev

# Terminal 2  
ngrok http 8787

# Terminal 3 - Set webhook to ngrok URL
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
-H "Content-Type: application/json" \
-d '{"url": "https://your-ngrok-url.ngrok.io/webhook"}'
```

### Error Investigation

**If worker returns 500 errors:**
1. Check if BOT_TOKEN secret is set
2. Verify telegram-webhook-js compatibility
3. Check for syntax errors in code
4. Test with minimal handler first

**If webhook shows "pending_update_count" > 0:**
1. There are unprocessed messages
2. Worker might be failing to respond
3. Check worker logs for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Open an issue on GitHub
3. Contact the maintainers

---

Built with ❤️ using Cloudflare Workers and Telegram Bot API.