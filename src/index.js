import TelegramBot from 'telegram-webhook-js';
import { handleMessage, ensureWorkspaceMember, addWorkspaceLink } from './handlers/commands.js';
import { handleCallback } from './handlers/callbacks.js';
import { handleRedirect } from './services/links.js';
import { serveBioPage } from './services/bio.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // QR code image endpoint
    if (url.pathname === '/qrcode') {
      return handleQrEndpoint(url);
    }

    // Telegram webhook
    if (url.pathname === '/webhook') {
      return handleWebhook(request, env, ctx);
    }

    // Bio page route: /bio/{code}
    if (url.pathname.startsWith('/bio/')) {
      const code = url.pathname.slice(5);
      if (code) {
        const response = await serveBioPage(code, request, env, ctx);
        if (response) return response;
      }
      return new Response('Page not found', { status: 404 });
    }

    // Short URL redirect: /{code}
    if (url.pathname.length > 1) {
      const code = url.pathname.slice(1);
      try {
        const response = await handleRedirect(code, request, env, ctx);
        if (response) return response;
      } catch (error) {
        console.error('Redirect error:', error);
      }
    }

    return new Response('Link Hub Bot - URL Shortener & Bio Pages', { status: 200 });
  },
};

// QR code endpoint — proxies to external QR API
async function handleQrEndpoint(url) {
  const urlToEncode = url.searchParams.get('url');
  if (!urlToEncode) {
    return new Response('URL parameter is required', { status: 400 });
  }
  try {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlToEncode)}`;
    const response = await fetch(qrImageUrl);
    if (!response.ok) throw new Error(`QR API error: ${response.status}`);
    return new Response(response.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return new Response(`Error generating QR code: ${error.message}`, { status: 500 });
  }
}

// Handle Telegram webhook POST
async function handleWebhook(request, env, ctx) {
  try {
    const bot = new TelegramBot(env.BOT_TOKEN);
    const update = await request.json();

    // Handle callback queries (inline keyboard button presses)
    if (update.callback_query) {
      await handleCallback(update.callback_query, bot, env, request);
      return new Response('OK', { status: 200 });
    }

    // Handle messages
    const message = update.message;
    if (message && message.text) {
      // Track workspace membership for group chats
      ctx.waitUntil(ensureWorkspaceMember(message, env));

      await handleMessage(message, bot, env, request, ctx);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('OK', { status: 200 }); // Always 200 to avoid Telegram retries
  }
}
