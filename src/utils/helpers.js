// Validate URL string (only http and https schemes allowed)
export function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Generate random alphanumeric short code using crypto
export function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

// Escape HTML special characters
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Get base URL from request (preserves port for local dev)
export function getBaseUrl(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

// Format number with commas
export function formatNumber(n) {
  return (n || 0).toLocaleString();
}

// Parse duration string to milliseconds (30m, 2h, 7d, or ISO date)
export function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([mhd])$/i);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Date.now() + value * multipliers[unit];
  }
  // Try ISO date
  const date = new Date(str);
  if (!isNaN(date.getTime()) && date.getTime() > Date.now()) {
    return date.getTime();
  }
  return null;
}

// Today's date key for stats
export function todayKey() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
