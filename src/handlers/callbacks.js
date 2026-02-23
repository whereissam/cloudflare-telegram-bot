import { getLink } from '../utils/kv.js';
import { getUserPreferences, setUserPreferences, QR_STYLES, COLOR_SCHEMES } from '../utils/preferences.js';
import { setUserState } from '../utils/state.js';
import { generateAdvancedQrCode } from '../utils/qr.js';
import { getStats, buildBarChart, topN } from '../services/analytics.js';
import { deleteOwnedLink } from '../services/bio.js';
import { expireKeyboard, editBioKeyboard } from '../utils/keyboard.js';
import { getBaseUrl, parseDuration, formatNumber } from '../utils/helpers.js';

// Answer a callback query (dismiss loading indicator)
async function answer(bot, callbackQueryId, text) {
  await fetch(`https://api.telegram.org/bot${bot.token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// Edit the message that triggered the callback
async function editMessage(bot, chatId, messageId, text, replyMarkup, parseMode = 'Markdown') {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
  };
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);
  await fetch(`https://api.telegram.org/bot${bot.token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Send a new message
async function sendMessage(bot, chatId, text, replyMarkup, parseMode = 'Markdown') {
  const body = { chat_id: chatId, text, parse_mode: parseMode };
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);
  await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function handleCallback(callbackQuery, bot, env, request) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const cbId = callbackQuery.id;

  // QR code for a link
  if (data.startsWith('qr:')) {
    const code = data.slice(3);
    const link = await getLink(code, env);
    if (!link) {
      await answer(bot, cbId, 'Link not found');
      return;
    }
    const prefs = await getUserPreferences(chatId, env);
    const qrUrl = `${link.url}${link.url.includes('?') ? '&' : '?'}src=qr`;
    try {
      await generateAdvancedQrCode(chatId, qrUrl, bot, env, prefs.style, prefs.colorScheme);
    } catch {
      await sendMessage(bot, chatId, 'Failed to generate QR code.');
    }
    await answer(bot, cbId);
    return;
  }

  // Stats for a link
  if (data.startsWith('stats:')) {
    const code = data.slice(6);
    const link = await getLink(code, env);
    if (!link) {
      await answer(bot, cbId, 'Link not found');
      return;
    }
    const stats = await getStats(code, env, 7);
    const chart = buildBarChart(stats.dailyClicks);
    const topRef = topN(stats.referrers).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  None';
    const topCountry = topN(stats.countries).map(([k, v]) => `  ${k}: ${v}`).join('\n') || '  None';

    let text = `*Stats for* \`${code}\`\n\n`;
    text += `Clicks: ${formatNumber(stats.clicks)}\n`;
    text += `Uniques: ${formatNumber(stats.uniques)}\n`;
    text += `QR Scans: ${formatNumber(stats.qrScans)}\n\n`;
    text += `Last 7 days: ${chart}\n\n`;
    text += `Top referrers:\n${topRef}\n\n`;
    text += `Top countries:\n${topCountry}`;

    if (link.expiresAt) {
      const exp = new Date(link.expiresAt);
      text += `\n\nExpires: ${exp.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    }
    if (link.maxClicks) {
      text += `\nMax clicks: ${link.maxClicks} (used: ${link.currentClicks || 0})`;
    }

    await sendMessage(bot, chatId, text);
    await answer(bot, cbId);
    return;
  }

  // Expire picker
  if (data.startsWith('expire:')) {
    const code = data.slice(7);
    const link = await getLink(code, env);
    if (!link || link.createdBy !== chatId) {
      await answer(bot, cbId, 'Link not found or not owned by you');
      return;
    }
    await sendMessage(bot, chatId, `Set expiration for \`${code}\`:`, expireKeyboard(code));
    await answer(bot, cbId);
    return;
  }

  // Set expiration
  if (data.startsWith('set_expire:')) {
    const parts = data.split(':');
    const code = parts[1];
    const duration = parts[2];
    const link = await getLink(code, env);
    if (!link || link.createdBy !== chatId) {
      await answer(bot, cbId, 'Not found or not yours');
      return;
    }
    const expiresAt = parseDuration(duration);
    if (!expiresAt) {
      await answer(bot, cbId, 'Invalid duration');
      return;
    }
    link.expiresAt = expiresAt;
    await env.shorturl.put(`link:${code}`, JSON.stringify(link));
    const expDate = new Date(expiresAt).toISOString().slice(0, 16).replace('T', ' ');
    await editMessage(bot, chatId, messageId, `Expiration set for \`${code}\`.\nExpires: ${expDate} UTC`);
    await answer(bot, cbId, 'Expiration set!');
    return;
  }

  // Edit bio page
  if (data.startsWith('edit:')) {
    const parts = data.split(':');
    const code = parts[1];
    const field = parts[2]; // title, desc, addlink, rmlink

    const link = await getLink(code, env);
    if (!link || link.createdBy !== chatId) {
      await answer(bot, cbId, 'Not found or not yours');
      return;
    }

    if (!field) {
      // Show edit keyboard
      if (link.type === 'page') {
        await sendMessage(bot, chatId, `Edit bio page \`${code}\`:`, editBioKeyboard(code));
      } else {
        await sendMessage(bot, chatId, `What do you want to change for \`${code}\`?\nSend the new destination URL:`);
        await setUserState(chatId, { waitingFor: 'edit_url', code }, env);
      }
      await answer(bot, cbId);
      return;
    }

    // Set state for field edit
    const stateMap = {
      title: 'edit_bio_title',
      desc: 'edit_bio_desc',
      addlink: 'edit_bio_addlink',
      rmlink: 'edit_bio_rmlink',
    };

    const promptMap = {
      title: 'Send the new title:',
      desc: 'Send the new description:',
      addlink: 'Send the new link in format: Label | URL',
      rmlink: `Current links:\n${(link.page?.buttons || []).map((b, i) => `${i + 1}. ${b.label}`).join('\n')}\n\nSend the number to remove:`,
    };

    await setUserState(chatId, { waitingFor: stateMap[field], code }, env);
    await sendMessage(bot, chatId, promptMap[field]);
    await answer(bot, cbId);
    return;
  }

  // Confirm delete
  if (data.startsWith('confirm_delete:')) {
    const code = data.slice(15);
    await editMessage(bot, chatId, messageId,
      `Are you sure you want to delete \`${code}\`? This cannot be undone.`,
      {
        inline_keyboard: [
          [
            { text: 'Yes, Delete', callback_data: `do_delete:${code}` },
            { text: 'Cancel', callback_data: 'cancel' },
          ],
        ],
      }
    );
    await answer(bot, cbId);
    return;
  }

  // Execute delete
  if (data.startsWith('do_delete:')) {
    const code = data.slice(10);
    const result = await deleteOwnedLink(code, chatId, env);
    if (result.ok) {
      await editMessage(bot, chatId, messageId, `Deleted \`${code}\`.`);
    } else {
      await editMessage(bot, chatId, messageId, `Failed: ${result.error}`);
    }
    await answer(bot, cbId);
    return;
  }

  // Share a link
  if (data.startsWith('share:')) {
    const code = data.slice(6);
    const baseUrl = getBaseUrl(request);
    const link = await getLink(code, env);
    if (!link) {
      await answer(bot, cbId, 'Link not found');
      return;
    }
    const url = link.type === 'page' ? `${baseUrl}/bio/${code}` : `${baseUrl}/${code}`;
    await sendMessage(bot, chatId, `Share this link:\n${url}`);
    await answer(bot, cbId);
    return;
  }

  // QR style selection
  if (data.startsWith('style:')) {
    const styleKey = data.slice(6);
    if (QR_STYLES[styleKey]) {
      const prefs = await getUserPreferences(chatId, env);
      await setUserPreferences(chatId, styleKey, prefs.colorScheme, env);
      await editMessage(bot, chatId, messageId, `QR style set to: ${QR_STYLES[styleKey].name}`);
      await answer(bot, cbId, 'Style updated!');
    } else {
      await answer(bot, cbId, 'Invalid style');
    }
    return;
  }

  // QR color selection
  if (data.startsWith('color:')) {
    const colorKey = data.slice(6);
    if (COLOR_SCHEMES[colorKey]) {
      const prefs = await getUserPreferences(chatId, env);
      await setUserPreferences(chatId, prefs.style, colorKey, env);
      await editMessage(bot, chatId, messageId, `Color scheme set to: ${COLOR_SCHEMES[colorKey].name}`);
      await answer(bot, cbId, 'Colors updated!');
    } else {
      await answer(bot, cbId, 'Invalid color');
    }
    return;
  }

  // Force shorten (after safety warning)
  if (data.startsWith('force_shorten:')) {
    const tempKey = data.slice(14);
    const raw = await env.shorturl.get(`temp:${tempKey}`);
    if (raw) {
      const { url: origUrl, chatId: origChat } = JSON.parse(raw);
      await env.shorturl.delete(`temp:${tempKey}`);
      // Import dynamically to avoid circular deps
      const { createShortLink } = await import('../services/links.js');
      const { code, shortUrl } = await createShortLink(origUrl, origChat, env, request);
      await sendMessage(bot, chatId, `Shortened (warning acknowledged):\n${shortUrl}`);
    }
    await answer(bot, cbId);
    return;
  }

  // Help categories
  if (data.startsWith('help:')) {
    const category = data.slice(5);
    const helpTexts = {
      urls: '*URL Operations*\n\n' +
        'Send any URL to shorten it\n' +
        '/qrcode \\[url] - Generate styled QR code\n' +
        '/checkurl \\[url] - Check URL safety\n' +
        '/report \\<url> - Report suspicious URL',
      qr: '*QR Code Customization*\n\n' +
        '/qrstyle - Change QR code style\n' +
        '/qrcolor - Change color scheme\n' +
        '/qrsettings - View current settings\n' +
        '/qrpreview - Preview all styles',
      analytics: '*Analytics*\n\n' +
        '/stats \\<code> - View link analytics\n' +
        '/toplinks - Your top 5 links by clicks\n' +
        '/export \\<code> - Download stats as CSV',
      bio: '*Link-in-Bio*\n\n' +
        '/bio - Create a new bio page\n' +
        '/edit \\<code> - Edit a bio page\n' +
        '/delete \\<code> - Delete a link or bio page',
      manage: '*Link Management*\n\n' +
        '/expire \\<code> \\<duration> - Set expiration\n' +
        '/onetime \\<url> - Create a one-time link\n' +
        'Duration formats: 30m, 2h, 7d, or a date',
      workspace: '*Workspace (Group Chats)*\n\n' +
        '/workspace - View workspace info\n' +
        '/workspace\\_stats - Aggregated analytics\n' +
        'The bot auto-creates a workspace in group chats.',
    };
    const text = helpTexts[category] || 'Unknown category';
    await sendMessage(bot, chatId, text);
    await answer(bot, cbId);
    return;
  }

  // Cancel
  if (data === 'cancel') {
    await editMessage(bot, chatId, messageId, 'Cancelled.');
    await answer(bot, cbId);
    return;
  }

  await answer(bot, cbId, 'Unknown action');
}
