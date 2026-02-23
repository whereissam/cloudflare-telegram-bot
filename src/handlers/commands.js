import { isValidUrl, getBaseUrl, parseDuration, formatNumber } from '../utils/helpers.js';
import { getUserState, setUserState, clearUserState } from '../utils/state.js';
import { getUserPreferences, setUserPreferences, QR_STYLES, COLOR_SCHEMES } from '../utils/preferences.js';
import { generateAdvancedQrCode, generateBasicQrCode } from '../utils/qr.js';
import { getLink, putLink, getUserLinks, addUserLink } from '../utils/kv.js';
import { shortLinkKeyboard, qrStyleKeyboard, qrColorKeyboard, helpKeyboard, bioKeyboard, editBioKeyboard, confirmDeleteKeyboard } from '../utils/keyboard.js';
import { createShortLink } from '../services/links.js';
import { fullSafetyCheck, checkUrlSafety, reportUrl } from '../services/safety.js';
import { fetchMetadata } from '../services/metadata.js';
import { getStats, buildBarChart, topN, exportCsv } from '../services/analytics.js';
import { createBioPage, updateBioPage, deleteOwnedLink } from '../services/bio.js';

// Send message with optional inline keyboard
async function send(bot, chatId, text, replyMarkup, parseMode = 'Markdown') {
  const body = { chat_id: chatId, text, parse_mode: parseMode };
  if (replyMarkup) body.reply_markup = JSON.stringify(replyMarkup);
  await fetch(`https://api.telegram.org/bot${bot.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Send a document (for CSV export)
async function sendDocument(bot, chatId, filename, content, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', new Blob([content], { type: 'text/csv' }), filename);
  if (caption) formData.append('caption', caption);
  await fetch(`https://api.telegram.org/bot${bot.token}/sendDocument`, {
    method: 'POST',
    body: formData,
  });
}

export async function handleMessage(message, bot, env, request, ctx) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  if (!text) return;

  // ---- Handle pending user states ----
  const state = await getUserState(chatId, env);
  if (state) {
    await handleState(state, chatId, text, bot, env, request);
    return;
  }

  // ---- Commands ----
  const cmd = text.split(' ')[0].split('@')[0].toLowerCase();
  const args = text.slice(cmd.length).trim();

  switch (cmd) {
    case '/start': return handleStart(chatId, bot);
    case '/help': return handleHelp(chatId, bot);
    case '/qrcode': return handleQrCode(chatId, args, bot, env);
    case '/qrstyle':
    case '/qr_style': return handleQrStyle(chatId, bot);
    case '/qrcolor':
    case '/qr_color': return handleQrColor(chatId, bot);
    case '/qrsettings':
    case '/qr_settings': return handleQrSettings(chatId, bot, env);
    case '/qrpreview': return handleQrPreview(chatId, bot, env);
    case '/checkurl': return handleCheckUrl(chatId, args, bot, env);
    case '/stats': return handleStats(chatId, args, bot, env);
    case '/toplinks': return handleTopLinks(chatId, bot, env);
    case '/export': return handleExport(chatId, args, bot, env);
    case '/bio': return handleBio(chatId, bot, env);
    case '/edit': return handleEdit(chatId, args, bot, env);
    case '/delete': return handleDelete(chatId, args, bot, env);
    case '/expire': return handleExpire(chatId, args, bot, env);
    case '/onetime': return handleOneTime(chatId, args, bot, env, request);
    case '/report': return handleReport(chatId, args, bot, env);
    case '/workspace': return handleWorkspace(message, bot, env);
    case '/workspace_stats': return handleWorkspaceStats(message, bot, env);
  }

  // ---- Plain URL → shorten ----
  if (isValidUrl(text)) {
    return shortenUrl(chatId, text, bot, env, request, ctx, message);
  }

  // ---- Unknown ----
  await send(bot, chatId, "I didn't understand that. Send a URL to shorten it, or use /help to see all commands.");
}

// --- State handler for multi-step flows ---
async function handleState(state, chatId, text, bot, env, request) {
  await clearUserState(chatId, env);

  switch (state.waitingFor) {
    case 'qr_url': {
      if (!isValidUrl(text)) {
        await send(bot, chatId, 'Please provide a valid URL. Example: https://example.com');
        return;
      }
      const prefs = await getUserPreferences(chatId, env);
      try {
        await generateAdvancedQrCode(chatId, text, bot, env, prefs.style, prefs.colorScheme);
      } catch {
        await send(bot, chatId, 'Failed to generate QR code. Trying basic version...');
        try { await generateBasicQrCode(chatId, text, bot); } catch {}
      }
      return;
    }

    case 'check_url': {
      if (!isValidUrl(text)) {
        await send(bot, chatId, 'Please provide a valid URL.');
        return;
      }
      await runCheckUrl(chatId, text, bot, env);
      return;
    }

    case 'bio_title': {
      await setUserState(chatId, { waitingFor: 'bio_description', bioTitle: text }, env);
      await send(bot, chatId, 'Enter a description for your bio page (or send "skip" to skip):');
      return;
    }

    case 'bio_description': {
      const desc = text.toLowerCase() === 'skip' ? '' : text;
      await setUserState(chatId, {
        waitingFor: 'bio_links',
        bioTitle: state.bioTitle,
        bioDescription: desc,
        bioButtons: [],
      }, env);
      await send(bot, chatId, 'Now add links. Send each as: Label | URL\n\nWhen done, send "done".');
      return;
    }

    case 'bio_links': {
      if (text.toLowerCase() === 'done') {
        const result = await createBioPage(chatId, {
          title: state.bioTitle,
          description: state.bioDescription,
          buttons: state.bioButtons || [],
        }, env, request);
        await send(bot, chatId,
          `Bio page created!\n\nCode: \`${result.code}\`\nURL: ${result.pageUrl}`,
          bioKeyboard(result.code, result.pageUrl));
        return;
      }
      const sep = text.indexOf('|');
      if (sep === -1) {
        await setUserState(chatId, state, env); // keep state
        await send(bot, chatId, 'Invalid format. Use: Label | URL\nOr send "done" to finish.');
        return;
      }
      const label = text.slice(0, sep).trim();
      const url = text.slice(sep + 1).trim();
      if (!isValidUrl(url)) {
        await setUserState(chatId, state, env);
        await send(bot, chatId, 'Invalid URL. Try again or send "done".');
        return;
      }
      const buttons = [...(state.bioButtons || []), { label, url }];
      await setUserState(chatId, { ...state, bioButtons: buttons }, env);
      await send(bot, chatId, `Added: ${label}\n\nSend another link or "done" to finish. (${buttons.length} links so far)`);
      return;
    }

    case 'edit_url': {
      if (!isValidUrl(text)) {
        await send(bot, chatId, 'Invalid URL.');
        return;
      }
      const link = await getLink(state.code, env);
      if (link && link.createdBy === chatId) {
        link.url = text;
        await putLink(state.code, link, env);
        await send(bot, chatId, `Link \`${state.code}\` updated to: ${text}`);
      } else {
        await send(bot, chatId, 'Link not found or not yours.');
      }
      return;
    }

    case 'edit_bio_title': {
      const result = await updateBioPage(state.code, chatId, { title: text }, env);
      await send(bot, chatId, result.ok ? `Title updated for \`${state.code}\`.` : `Error: ${result.error}`);
      return;
    }

    case 'edit_bio_desc': {
      const result = await updateBioPage(state.code, chatId, { description: text }, env);
      await send(bot, chatId, result.ok ? `Description updated for \`${state.code}\`.` : `Error: ${result.error}`);
      return;
    }

    case 'edit_bio_addlink': {
      const sep = text.indexOf('|');
      if (sep === -1) {
        await send(bot, chatId, 'Use format: Label | URL');
        return;
      }
      const label = text.slice(0, sep).trim();
      const url = text.slice(sep + 1).trim();
      if (!isValidUrl(url)) {
        await send(bot, chatId, 'Invalid URL.');
        return;
      }
      const result = await updateBioPage(state.code, chatId, { addButton: { label, url } }, env);
      await send(bot, chatId, result.ok ? `Link added to \`${state.code}\`.` : `Error: ${result.error}`);
      return;
    }

    case 'edit_bio_rmlink': {
      const idx = parseInt(text) - 1;
      if (isNaN(idx) || idx < 0) {
        await send(bot, chatId, 'Invalid number.');
        return;
      }
      const result = await updateBioPage(state.code, chatId, { removeButtonIndex: idx }, env);
      await send(bot, chatId, result.ok ? `Link removed from \`${state.code}\`.` : `Error: ${result.error}`);
      return;
    }

    case 'expire_input': {
      const expiresAt = parseDuration(text);
      if (!expiresAt) {
        await send(bot, chatId, 'Invalid duration. Examples: 30m, 2h, 7d, 2026-03-01');
        return;
      }
      const link = await getLink(state.code, env);
      if (link && link.createdBy === chatId) {
        link.expiresAt = expiresAt;
        await putLink(state.code, link, env);
        const expDate = new Date(expiresAt).toISOString().slice(0, 16).replace('T', ' ');
        await send(bot, chatId, `Expiration set for \`${state.code}\`.\nExpires: ${expDate} UTC`);
      } else {
        await send(bot, chatId, 'Link not found or not yours.');
      }
      return;
    }
  }
}

// ---- Command Handlers ----

async function handleStart(chatId, bot) {
  await send(bot, chatId,
    '*Welcome to Link Hub Bot!*\n\n' +
    '*Features:*\n' +
    'Send any URL to shorten it\n' +
    'Styled QR codes with custom colors\n' +
    'Link-in-bio pages\n' +
    'Click analytics & tracking\n' +
    'Expiring & one-time links\n' +
    'URL safety checking\n\n' +
    '*Quick Start:*\n' +
    '/qrcode - Create styled QR codes\n' +
    '/bio - Build a link-in-bio page\n' +
    '/help - All commands');
}

async function handleHelp(chatId, bot) {
  await send(bot, chatId,
    '*Link Hub Bot - Commands*\n\nTap a category to see commands:',
    helpKeyboard());
}

async function handleQrCode(chatId, args, bot, env) {
  if (!args) {
    await setUserState(chatId, { waitingFor: 'qr_url' }, env);
    await send(bot, chatId, 'Send the URL you want to convert to a QR code:');
    return;
  }
  if (!isValidUrl(args)) {
    await send(bot, chatId, 'Please provide a valid URL. Example: /qrcode https://example.com');
    return;
  }
  const prefs = await getUserPreferences(chatId, env);
  try {
    await generateAdvancedQrCode(chatId, args, bot, env, prefs.style, prefs.colorScheme);
  } catch {
    await send(bot, chatId, 'Failed to generate QR code.');
    try { await generateBasicQrCode(chatId, args, bot); } catch {}
  }
}

async function handleQrStyle(chatId, bot) {
  await send(bot, chatId, 'Choose your QR code style:', qrStyleKeyboard());
}

async function handleQrColor(chatId, bot) {
  await send(bot, chatId, 'Choose your QR code color scheme:', qrColorKeyboard());
}

async function handleQrSettings(chatId, bot, env) {
  const prefs = await getUserPreferences(chatId, env);
  await send(bot, chatId,
    '*Your QR Settings:*\n\n' +
    `Style: ${QR_STYLES[prefs.style]?.name || 'Unknown'}\n` +
    `Colors: ${COLOR_SCHEMES[prefs.colorScheme]?.name || 'Unknown'}\n\n` +
    'Use /qrstyle to change style\nUse /qrcolor to change colors');
}

async function handleQrPreview(chatId, bot, env) {
  const sampleUrl = 'https://telegram.org';
  await send(bot, chatId, 'Generating style previews...');
  const prefs = await getUserPreferences(chatId, env);
  for (const [styleKey] of Object.entries(QR_STYLES)) {
    try {
      await generateAdvancedQrCode(chatId, sampleUrl, bot, env, styleKey, prefs.colorScheme);
      await new Promise(r => setTimeout(r, 500));
    } catch {}
  }
}

async function handleCheckUrl(chatId, args, bot, env) {
  if (!args) {
    await setUserState(chatId, { waitingFor: 'check_url' }, env);
    await send(bot, chatId, 'Send the URL you want to check for safety:');
    return;
  }
  if (!isValidUrl(args)) {
    await send(bot, chatId, 'Please provide a valid URL.');
    return;
  }
  await runCheckUrl(chatId, args, bot, env);
}

async function runCheckUrl(chatId, url, bot, env) {
  await send(bot, chatId, `Checking URL safety for: ${url}`);
  const result = await fullSafetyCheck(url, env);

  const levelEmoji = { safe: 'Safe', suspicious: 'Suspicious', dangerous: 'Dangerous' };
  let text = `*URL Safety Report*\n\nRisk level: *${levelEmoji[result.level] || result.level}*\n`;

  if (result.reasons.length > 0) {
    text += '\nFindings:\n' + result.reasons.map(r => `- ${r}`).join('\n');
  } else {
    text += '\nNo security concerns detected.';
  }
  text += '\n\nAlways be cautious when visiting unfamiliar websites.';
  await send(bot, chatId, text);
}

async function handleStats(chatId, args, bot, env) {
  if (!args) {
    await send(bot, chatId, 'Usage: /stats <code>');
    return;
  }
  const code = args.trim();
  const link = await getLink(code, env);
  if (!link) {
    await send(bot, chatId, 'Link not found.');
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
    const exp = new Date(link.expiresAt).toISOString().slice(0, 16).replace('T', ' ');
    text += `\n\nExpires: ${exp} UTC`;
  }
  if (link.maxClicks) {
    text += `\nMax clicks: ${link.maxClicks} (used: ${link.currentClicks || 0})`;
  }

  await send(bot, chatId, text);
}

async function handleTopLinks(chatId, bot, env) {
  const codes = await getUserLinks(chatId, env);
  if (!codes.length) {
    await send(bot, chatId, 'You have no links yet. Send a URL to create one!');
    return;
  }

  const linkStats = [];
  for (const code of codes.slice(-20)) { // limit to most recent 20
    const stats = await getStats(code, env, 30);
    linkStats.push({ code, clicks: stats.clicks });
  }

  linkStats.sort((a, b) => b.clicks - a.clicks);
  const top5 = linkStats.slice(0, 5);

  let text = '*Your Top Links*\n\n';
  top5.forEach((ls, i) => {
    text += `${i + 1}. \`${ls.code}\` - ${formatNumber(ls.clicks)} clicks\n`;
  });

  await send(bot, chatId, text);
}

async function handleExport(chatId, args, bot, env) {
  if (!args) {
    await send(bot, chatId, 'Usage: /export <code>');
    return;
  }
  const code = args.trim();
  const link = await getLink(code, env);
  if (!link) {
    await send(bot, chatId, 'Link not found.');
    return;
  }

  const csv = await exportCsv(code, env, 30);
  await sendDocument(bot, chatId, `stats_${code}.csv`, csv, `Stats export for ${code} (last 30 days)`);
}

async function handleBio(chatId, bot, env) {
  await setUserState(chatId, { waitingFor: 'bio_title' }, env);
  await send(bot, chatId, 'Let\'s create a bio page!\n\nEnter a title:');
}

async function handleEdit(chatId, args, bot, env) {
  if (!args) {
    await send(bot, chatId, 'Usage: /edit <code>');
    return;
  }
  const code = args.trim();
  const link = await getLink(code, env);
  if (!link) {
    await send(bot, chatId, 'Link not found.');
    return;
  }
  if (link.createdBy !== chatId) {
    await send(bot, chatId, 'You do not own this link.');
    return;
  }

  if (link.type === 'page') {
    await send(bot, chatId, `Edit bio page \`${code}\`:`, editBioKeyboard(code));
  } else {
    await setUserState(chatId, { waitingFor: 'edit_url', code }, env);
    await send(bot, chatId, `Send the new destination URL for \`${code}\`:`);
  }
}

async function handleDelete(chatId, args, bot, env) {
  if (!args) {
    await send(bot, chatId, 'Usage: /delete <code>');
    return;
  }
  const code = args.trim();
  const link = await getLink(code, env);
  if (!link) {
    await send(bot, chatId, 'Link not found.');
    return;
  }
  if (link.createdBy !== chatId) {
    await send(bot, chatId, 'You do not own this link.');
    return;
  }

  await send(bot, chatId, `Delete \`${code}\`? This cannot be undone.`, confirmDeleteKeyboard(code));
}

async function handleExpire(chatId, args, bot, env) {
  if (!args) {
    await send(bot, chatId, 'Usage: /expire <code> <duration>\nExamples: /expire abc123 2h, /expire abc123 7d');
    return;
  }
  const parts = args.split(/\s+/);
  const code = parts[0];
  const duration = parts[1];

  const link = await getLink(code, env);
  if (!link) {
    await send(bot, chatId, 'Link not found.');
    return;
  }
  if (link.createdBy !== chatId) {
    await send(bot, chatId, 'You do not own this link.');
    return;
  }

  if (!duration) {
    await setUserState(chatId, { waitingFor: 'expire_input', code }, env);
    await send(bot, chatId, 'Send the expiration duration (e.g., 30m, 2h, 7d) or a date (2026-03-01):');
    return;
  }

  const expiresAt = parseDuration(duration);
  if (!expiresAt) {
    await send(bot, chatId, 'Invalid duration. Examples: 30m, 2h, 7d, 2026-03-01');
    return;
  }

  link.expiresAt = expiresAt;
  await putLink(code, link, env);
  const expDate = new Date(expiresAt).toISOString().slice(0, 16).replace('T', ' ');
  await send(bot, chatId, `Expiration set for \`${code}\`.\nExpires: ${expDate} UTC`);
}

async function handleOneTime(chatId, args, bot, env, request) {
  if (!args || !isValidUrl(args)) {
    await send(bot, chatId, 'Usage: /onetime <url>\nCreates a link that works exactly once.');
    return;
  }

  const safetyCheck = await checkUrlSafety(args, env);
  if (!safetyCheck.safe) {
    await send(bot, chatId, 'This URL was flagged as potentially harmful. One-time link not created.');
    return;
  }

  const { code, shortUrl } = await createShortLink(args, chatId, env, request, { maxClicks: 1 });
  await send(bot, chatId,
    `*One-Time Link Created*\n\n` +
    `URL: ${shortUrl}\n` +
    `This link will self-destruct after one click.`,
    shortLinkKeyboard(code, shortUrl));
}

async function handleReport(chatId, args, bot, env) {
  if (!args || !isValidUrl(args)) {
    await send(bot, chatId, 'Usage: /report <url>\nReport a suspicious URL to the community blocklist.');
    return;
  }

  const result = await reportUrl(args, chatId, env);
  if (!result.ok) {
    await send(bot, chatId, `Could not report: ${result.error}`);
    return;
  }
  await send(bot, chatId, `Reported domain: ${result.domain}\nTotal reports: ${result.reportCount}\n\nThank you for helping keep links safe!`);
}

async function handleWorkspace(message, bot, env) {
  const chatId = message.chat.id;
  if (message.chat.type === 'private') {
    await send(bot, chatId, 'Workspaces are for group chats. Add me to a group to use this feature!');
    return;
  }

  const wsKey = `workspace:${chatId}`;
  const raw = await env.shorturl.get(wsKey);
  let ws = raw ? JSON.parse(raw) : null;

  if (!ws) {
    ws = {
      name: message.chat.title || 'Workspace',
      admins: [],
      members: [],
      links: [],
    };
    await env.shorturl.put(wsKey, JSON.stringify(ws));
  }

  await send(bot, chatId,
    `*Workspace: ${ws.name}*\n\n` +
    `Members: ${ws.members.length}\n` +
    `Links: ${ws.links.length}\n\n` +
    'All links created in this group are shared with the workspace.');
}

async function handleWorkspaceStats(message, bot, env) {
  const chatId = message.chat.id;
  if (message.chat.type === 'private') {
    await send(bot, chatId, 'This command is for group chats.');
    return;
  }

  const wsKey = `workspace:${chatId}`;
  const raw = await env.shorturl.get(wsKey);
  if (!raw) {
    await send(bot, chatId, 'No workspace found. Create a link first!');
    return;
  }
  const ws = JSON.parse(raw);

  let totalClicks = 0;
  let totalUniques = 0;
  const topLinks = [];

  for (const code of (ws.links || []).slice(-20)) {
    const stats = await getStats(code, env, 30);
    totalClicks += stats.clicks;
    totalUniques += stats.uniques;
    topLinks.push({ code, clicks: stats.clicks });
  }

  topLinks.sort((a, b) => b.clicks - a.clicks);
  const top3 = topLinks.slice(0, 3).map((l, i) => `${i + 1}. \`${l.code}\` - ${formatNumber(l.clicks)} clicks`).join('\n');

  await send(bot, chatId,
    `*Workspace Stats*\n\n` +
    `Total clicks: ${formatNumber(totalClicks)}\n` +
    `Total uniques: ${formatNumber(totalUniques)}\n` +
    `Links tracked: ${ws.links.length}\n\n` +
    `*Top links:*\n${top3 || 'No data yet'}`);
}

// ---- URL Shortening with smart previews ----
async function shortenUrl(chatId, originalUrl, bot, env, request, ctx, message) {
  // Run safety check and metadata fetch in parallel
  const [safetyResult, metadata] = await Promise.allSettled([
    fullSafetyCheck(originalUrl, env),
    fetchMetadata(originalUrl, env),
  ]);

  const safety = safetyResult.status === 'fulfilled' ? safetyResult.value : { level: 'safe', reasons: [] };
  const meta = metadata.status === 'fulfilled' ? metadata.value : null;

  // Block dangerous URLs
  if (safety.level === 'dangerous') {
    await send(bot, chatId, 'This URL has been identified as potentially harmful. Shortening cancelled for your safety.');
    return;
  }

  // Warn for suspicious URLs
  if (safety.level === 'suspicious') {
    const tempKey = `warn_${Date.now()}`;
    await env.shorturl.put(`temp:${tempKey}`, JSON.stringify({ url: originalUrl, chatId }), { expirationTtl: 300 });
    let text = 'This URL has some concerns:\n' + safety.reasons.map(r => `- ${r}`).join('\n');
    text += '\n\nDo you still want to shorten it?';
    await send(bot, chatId, text, {
      inline_keyboard: [[
        { text: 'Shorten Anyway', callback_data: `force_shorten:${tempKey}` },
        { text: 'Cancel', callback_data: 'cancel' },
      ]],
    });
    return;
  }

  const { code, shortUrl } = await createShortLink(originalUrl, chatId, env, request);

  // Also add to workspace if in group chat
  if (message && message.chat.type !== 'private') {
    await addWorkspaceLink(message.chat.id, code, env);
  }

  // Build rich response
  let text = '';
  if (meta?.title) {
    text += `*${escapeMd(meta.title)}*\n`;
  }
  if (meta?.domain) {
    text += `${meta.domain}\n`;
  }
  if (meta?.description) {
    const desc = meta.description.length > 100 ? meta.description.slice(0, 100) + '...' : meta.description;
    text += `_${escapeMd(desc)}_\n`;
  }
  text += `\nShort URL: ${shortUrl}`;

  await send(bot, chatId, text, shortLinkKeyboard(code, shortUrl));
}

// Escape Markdown special chars
function escapeMd(str) {
  if (!str) return '';
  return str.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// Workspace helper — ensure group member is tracked
export async function ensureWorkspaceMember(message, env) {
  if (message.chat.type === 'private') return;
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  const wsKey = `workspace:${chatId}`;
  const raw = await env.shorturl.get(wsKey);
  let ws = raw ? JSON.parse(raw) : {
    name: message.chat.title || 'Workspace',
    admins: [],
    members: [],
    links: [],
  };

  if (!ws.members.includes(userId)) {
    ws.members.push(userId);
    await env.shorturl.put(wsKey, JSON.stringify(ws));
  }
}

// Add link to workspace
export async function addWorkspaceLink(chatId, code, env) {
  const wsKey = `workspace:${chatId}`;
  const raw = await env.shorturl.get(wsKey);
  if (!raw) return;
  const ws = JSON.parse(raw);
  if (!ws.links.includes(code)) {
    ws.links.push(code);
    await env.shorturl.put(wsKey, JSON.stringify(ws));
  }
}

