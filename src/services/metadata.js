// Fetch OG metadata from a URL with timeout
export async function fetchMetadata(url, env) {
  // Check cache first
  const cacheKey = `meta:${encodeURIComponent(url).slice(0, 200)}`;
  const cached = await env.shorturl.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkBot/2.0)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await response.text();

    // Extract metadata with regex
    const meta = {
      title: extractMeta(html, 'og:title') || extractTitle(html),
      description: extractMeta(html, 'og:description') || extractMeta(html, 'description'),
      image: extractMeta(html, 'og:image'),
      domain: new URL(url).hostname,
      fetchedAt: Date.now(),
    };

    // Cache for 7 days
    if (meta.title || meta.description) {
      await env.shorturl.put(cacheKey, JSON.stringify(meta), { expirationTtl: 604800 });
    }

    return meta;
  } catch {
    return null;
  }
}

function extractMeta(html, property) {
  // Try og: / name= / property= patterns
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(property)}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
