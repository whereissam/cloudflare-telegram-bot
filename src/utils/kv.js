// Get link data with legacy migration support
// New format: link:{code} → JSON object
// Legacy format: {code} → plain URL string
export async function getLink(code, env) {
  // Try new format first
  const data = await env.shorturl.get(`link:${code}`);
  if (data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  // Fallback: legacy bare key (plain URL string)
  const legacyUrl = await env.shorturl.get(code);
  if (legacyUrl) {
    // Lazy-migrate to new format
    const linkData = {
      type: 'redirect',
      url: legacyUrl,
      createdBy: null,
      createdAt: Date.now(),
    };
    await env.shorturl.put(`link:${code}`, JSON.stringify(linkData));
    // Keep legacy key around for safety
    return linkData;
  }

  return null;
}

// Store link data in new format
export async function putLink(code, data, env) {
  await env.shorturl.put(`link:${code}`, JSON.stringify(data));
}

// Add a link code to a user's link list
export async function addUserLink(chatId, code, env) {
  const raw = await env.shorturl.get(`user:${chatId}`);
  const userData = raw ? JSON.parse(raw) : { links: [] };
  if (!userData.links.includes(code)) {
    userData.links.push(code);
  }
  await env.shorturl.put(`user:${chatId}`, JSON.stringify(userData));
}

// Get user's link list
export async function getUserLinks(chatId, env) {
  const raw = await env.shorturl.get(`user:${chatId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw).links || [];
  } catch {
    return [];
  }
}

// Remove a link code from a user's link list
export async function removeUserLink(chatId, code, env) {
  const raw = await env.shorturl.get(`user:${chatId}`);
  if (!raw) return;
  const userData = JSON.parse(raw);
  userData.links = (userData.links || []).filter(c => c !== code);
  await env.shorturl.put(`user:${chatId}`, JSON.stringify(userData));
}

// Delete a link entirely
export async function deleteLink(code, env) {
  await env.shorturl.delete(`link:${code}`);
}
