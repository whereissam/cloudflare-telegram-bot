// Google Safe Browsing API check
export async function checkUrlSafety(url, env) {
  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'url-shortener-bot', clientVersion: '2.0.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );

    if (!response.ok) {
      return { safe: true, error: 'API error' };
    }

    const data = await response.json();
    return {
      safe: !data.matches || data.matches.length === 0,
      threats: data.matches || [],
    };
  } catch (error) {
    return { safe: true, error: error.message };
  }
}

// Known suspicious TLDs
const SUSPICIOUS_TLDS = new Set(['.tk', '.ml', '.ga', '.cf', '.gq', '.zip', '.mov', '.top', '.buzz', '.work']);

// Popular domains for lookalike detection
const POPULAR_DOMAINS = [
  'google.com', 'facebook.com', 'amazon.com', 'apple.com', 'microsoft.com',
  'paypal.com', 'netflix.com', 'instagram.com', 'twitter.com', 'linkedin.com',
  'github.com', 'dropbox.com', 'yahoo.com', 'outlook.com', 'gmail.com',
];

// Levenshtein distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Check for punycode/homoglyph
function hasPunycode(hostname) {
  return hostname.includes('xn--');
}

// Analyze URL with heuristics
export async function analyzeUrl(urlString, env) {
  const reasons = [];
  let level = 'safe';

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { level: 'dangerous', reasons: ['Invalid URL'] };
  }

  const hostname = parsed.hostname;

  // Punycode / homoglyph
  if (hasPunycode(hostname)) {
    reasons.push('Contains punycode (internationalized characters that may mimic ASCII)');
    level = 'suspicious';
  }

  // Lookalike domain detection
  const baseDomain = hostname.replace(/^www\./, '');
  for (const popular of POPULAR_DOMAINS) {
    if (baseDomain !== popular) {
      const dist = levenshtein(baseDomain, popular);
      if (dist > 0 && dist <= 2) {
        reasons.push(`Looks similar to ${popular} (edit distance: ${dist})`);
        level = 'suspicious';
        break;
      }
    }
  }

  // Suspicious TLD
  const tld = '.' + hostname.split('.').pop();
  if (SUSPICIOUS_TLDS.has(tld)) {
    reasons.push(`Uses suspicious TLD: ${tld}`);
    level = 'suspicious';
  }

  // URL length
  if (urlString.length > 2000) {
    reasons.push('Excessively long URL (>2000 characters)');
    level = 'suspicious';
  }

  // Excessive subdomains
  const parts = hostname.split('.');
  if (parts.length > 4) {
    reasons.push(`Excessive subdomains (${parts.length} levels)`);
    level = 'suspicious';
  }

  // IP address as hostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    reasons.push('Uses IP address instead of domain name');
    level = 'suspicious';
  }

  // @ in URL (credential trick)
  if (urlString.includes('@') && urlString.indexOf('@') < urlString.indexOf(hostname)) {
    reasons.push('Contains @ symbol before hostname (credential trick)');
    level = 'dangerous';
  }

  // Check community blocklist
  const domain = hostname.replace(/^www\./, '');
  const blocklistRaw = await env.shorturl.get(`blocklist:${domain}`);
  if (blocklistRaw) {
    const blocklist = JSON.parse(blocklistRaw);
    if (blocklist.reportCount >= 3) {
      reasons.push(`Community-reported as suspicious (${blocklist.reportCount} reports)`);
      level = 'dangerous';
    } else if (blocklist.reportCount >= 1) {
      reasons.push(`Community-reported (${blocklist.reportCount} report${blocklist.reportCount > 1 ? 's' : ''})`);
      if (level === 'safe') level = 'suspicious';
    }
  }

  return { level, reasons };
}

// Combined safety check: Google Safe Browsing + heuristics
export async function fullSafetyCheck(url, env) {
  const [googleResult, heuristicResult] = await Promise.all([
    checkUrlSafety(url, env),
    analyzeUrl(url, env),
  ]);

  const reasons = [...heuristicResult.reasons];
  let level = heuristicResult.level;

  if (!googleResult.safe) {
    level = 'dangerous';
    const types = googleResult.threats.map(t => t.threatType).join(', ');
    reasons.unshift(`Google Safe Browsing: ${types}`);
  }

  return { level, reasons, googleSafe: googleResult.safe };
}

// Report a URL to the community blocklist (rate limited)
export async function reportUrl(urlString, chatId, env) {
  let hostname;
  try {
    hostname = new URL(urlString).hostname.replace(/^www\./, '');
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  // Rate limit: 10 reports per day per user
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rateLimitKey = `ratelimit:report:${chatId}:${today}`;
  const currentCount = parseInt(await env.shorturl.get(rateLimitKey) || '0');
  if (currentCount >= 10) {
    return { ok: false, error: 'Daily report limit reached (10/day)' };
  }

  // Increment rate limit
  await env.shorturl.put(rateLimitKey, String(currentCount + 1), { expirationTtl: 86400 });

  // Update blocklist
  const blockKey = `blocklist:${hostname}`;
  const raw = await env.shorturl.get(blockKey);
  const entry = raw ? JSON.parse(raw) : { reportedBy: [], reportedAt: Date.now(), reportCount: 0 };

  if (!entry.reportedBy.includes(chatId)) {
    entry.reportedBy.push(chatId);
    entry.reportCount++;
    entry.reportedAt = Date.now();
  }

  await env.shorturl.put(blockKey, JSON.stringify(entry));
  return { ok: true, domain: hostname, reportCount: entry.reportCount };
}
