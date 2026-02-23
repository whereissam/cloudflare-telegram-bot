import { todayKey } from '../utils/helpers.js';

// Track a click on a short link (non-blocking, use with ctx.waitUntil)
export async function trackClick(code, request, env, isQrScan = false) {
  const date = todayKey();
  const statsKey = `stats:${code}:${date}`;

  // Read current stats
  const raw = await env.shorturl.get(statsKey);
  const stats = raw ? JSON.parse(raw) : {
    clicks: 0,
    uniques: 0,
    referrers: {},
    countries: {},
    qrScans: 0,
  };

  stats.clicks++;

  if (isQrScan) {
    stats.qrScans++;
  }

  // Referrer tracking
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      const domain = new URL(referer).hostname;
      stats.referrers[domain] = (stats.referrers[domain] || 0) + 1;
    } catch {}
  }

  // Country tracking (Cloudflare header)
  const country = request.headers.get('CF-IPCountry') || 'unknown';
  stats.countries[country] = (stats.countries[country] || 0) + 1;

  // Unique visitor dedup via hash of IP+UA
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ua = request.headers.get('User-Agent') || '';
  const visitorRaw = `${ip}:${ua}`;
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(visitorRaw));
  const hash = [...new Uint8Array(hashBuf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  const visitorKey = `visitor:${code}:${hash}:${date}`;
  const existing = await env.shorturl.get(visitorKey);
  if (!existing) {
    stats.uniques++;
    await env.shorturl.put(visitorKey, '1', { expirationTtl: 86400 });
  }

  await env.shorturl.put(statsKey, JSON.stringify(stats));

  // Also increment currentClicks on the link itself
  const linkRaw = await env.shorturl.get(`link:${code}`);
  if (linkRaw) {
    try {
      const link = JSON.parse(linkRaw);
      link.currentClicks = (link.currentClicks || 0) + 1;
      await env.shorturl.put(`link:${code}`, JSON.stringify(link));
    } catch {}
  }
}

// Get aggregated stats for a code over N days
export async function getStats(code, env, days = 7) {
  const totals = { clicks: 0, uniques: 0, referrers: {}, countries: {}, qrScans: 0 };
  const dailyClicks = [];

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10).replace(/-/g, '');
    const raw = await env.shorturl.get(`stats:${code}:${dateKey}`);
    if (raw) {
      const day = JSON.parse(raw);
      totals.clicks += day.clicks || 0;
      totals.uniques += day.uniques || 0;
      totals.qrScans += day.qrScans || 0;
      for (const [k, v] of Object.entries(day.referrers || {})) {
        totals.referrers[k] = (totals.referrers[k] || 0) + v;
      }
      for (const [k, v] of Object.entries(day.countries || {})) {
        totals.countries[k] = (totals.countries[k] || 0) + v;
      }
      dailyClicks.push({ date: dateKey, clicks: day.clicks || 0 });
    } else {
      dailyClicks.push({ date: dateKey, clicks: 0 });
    }
  }

  return { ...totals, dailyClicks: dailyClicks.reverse() };
}

// Build a text-based bar chart of daily clicks
export function buildBarChart(dailyClicks) {
  if (!dailyClicks.length) return 'No data';
  const max = Math.max(...dailyClicks.map(d => d.clicks), 1);
  const bars = ['_', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];

  return dailyClicks.map(d => {
    const level = Math.round((d.clicks / max) * 8);
    return bars[level];
  }).join('');
}

// Top N items from an object { key: count }
export function topN(obj, n = 3) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// Generate CSV content for a code's stats
export async function exportCsv(code, env, days = 30) {
  let csv = 'Date,Clicks,Uniques,QR Scans\n';
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10).replace(/-/g, '');
    const dateFormatted = d.toISOString().slice(0, 10);
    const raw = await env.shorturl.get(`stats:${code}:${dateKey}`);
    if (raw) {
      const day = JSON.parse(raw);
      csv += `${dateFormatted},${day.clicks || 0},${day.uniques || 0},${day.qrScans || 0}\n`;
    } else {
      csv += `${dateFormatted},0,0,0\n`;
    }
  }
  return csv;
}
