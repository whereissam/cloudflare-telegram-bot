import { putLink, getLink, addUserLink, removeUserLink, deleteLink } from '../utils/kv.js';
import { generateShortCode, getBaseUrl } from '../utils/helpers.js';
import { renderBioPage } from '../templates/bio-page.js';
import { trackClick } from './analytics.js';

// Create a new bio page
export async function createBioPage(chatId, pageData, env, request) {
  const code = generateShortCode();
  const baseUrl = getBaseUrl(request);

  const linkData = {
    type: 'page',
    page: {
      title: pageData.title,
      description: pageData.description || '',
      buttons: pageData.buttons || [],
      theme: pageData.theme || 'light',
    },
    createdBy: chatId,
    createdAt: Date.now(),
    expiresAt: null,
    maxClicks: null,
    currentClicks: 0,
  };

  await putLink(code, linkData, env);
  await addUserLink(chatId, code, env);

  return { code, pageUrl: `${baseUrl}/bio/${code}` };
}

// Serve a bio page as HTML
export async function serveBioPage(code, request, env, ctx) {
  const link = await getLink(code, env);
  if (!link || link.type !== 'page') return null;

  // Check expiration
  if (link.expiresAt && Date.now() > link.expiresAt) {
    return new Response('This page has expired.', { status: 410 });
  }

  // Track visit
  ctx.waitUntil(trackClick(code, request, env, false));

  const html = renderBioPage(link.page, code);
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Update a bio page field
export async function updateBioPage(code, chatId, updates, env) {
  const link = await getLink(code, env);
  if (!link || link.type !== 'page') return { ok: false, error: 'Bio page not found' };
  if (link.createdBy !== chatId) return { ok: false, error: 'You do not own this page' };

  if (updates.title !== undefined) link.page.title = updates.title;
  if (updates.description !== undefined) link.page.description = updates.description;
  if (updates.addButton) link.page.buttons.push(updates.addButton);
  if (updates.removeButtonIndex !== undefined) {
    link.page.buttons.splice(updates.removeButtonIndex, 1);
  }
  if (updates.theme !== undefined) link.page.theme = updates.theme;

  await putLink(code, link, env);
  return { ok: true };
}

// Delete a link/bio (with ownership check)
export async function deleteOwnedLink(code, chatId, env) {
  const link = await getLink(code, env);
  if (!link) return { ok: false, error: 'Link not found' };
  if (link.createdBy !== chatId) return { ok: false, error: 'You do not own this link' };

  await deleteLink(code, env);
  await removeUserLink(chatId, code, env);
  return { ok: true };
}
