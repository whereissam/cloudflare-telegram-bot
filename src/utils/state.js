// KV-backed user state management (replaces in-memory userStates)
// Keys: state:{chatId} with TTL of 1 hour

const STATE_TTL = 3600; // 1 hour in seconds

export async function getUserState(chatId, env) {
  const raw = await env.shorturl.get(`state:${chatId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setUserState(chatId, state, env) {
  await env.shorturl.put(`state:${chatId}`, JSON.stringify(state), {
    expirationTtl: STATE_TTL,
  });
}

export async function clearUserState(chatId, env) {
  await env.shorturl.delete(`state:${chatId}`);
}
