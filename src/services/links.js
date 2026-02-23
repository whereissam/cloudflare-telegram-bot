import { getLink, putLink, addUserLink } from '../utils/kv.js';
import { generateShortCode, getBaseUrl } from '../utils/helpers.js';
import { trackClick } from './analytics.js';
import { renderExpiredPage } from '../templates/expired-page.js';

// Create a shortened link
export async function createShortLink(originalUrl, chatId, env, request, options = {}) {
  const code = generateShortCode();
  const baseUrl = getBaseUrl(request);

  const linkData = {
    type: 'redirect',
    url: originalUrl,
    createdBy: chatId,
    createdAt: Date.now(),
    expiresAt: options.expiresAt || null,
    maxClicks: options.maxClicks || null,
    currentClicks: 0,
  };

  await putLink(code, linkData, env);
  await addUserLink(chatId, code, env);

  return { code, shortUrl: `${baseUrl}/${code}` };
}

// Handle redirect for a short code
export async function handleRedirect(code, request, env, ctx) {
  const link = await getLink(code, env);
  if (!link) return null;

  // Only redirect type
  if (link.type !== 'redirect') return null;

  // Check expiration
  if (link.expiresAt && Date.now() > link.expiresAt) {
    return new Response(renderExpiredPage(code), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Check max clicks
  if (link.maxClicks && (link.currentClicks || 0) >= link.maxClicks) {
    return new Response(renderExpiredPage(code, true), {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Track click (non-blocking)
  const url = new URL(request.url);
  const isQrScan = url.searchParams.get('src') === 'qr';
  ctx.waitUntil(trackClick(code, request, env, isQrScan));

  return Response.redirect(link.url, 301);
}
