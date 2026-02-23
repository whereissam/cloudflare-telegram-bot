export const QR_STYLES = {
  square: { name: 'Classic Square', value: 'square' },
  rounded: { name: 'Rounded Corners', value: 'rounded' },
  dots: { name: 'Circular Dots', value: 'dots' },
};

export const COLOR_SCHEMES = {
  classic: { name: 'Classic (Black & White)', foreground: '#000000', background: '#ffffff' },
  blue: { name: 'Business Blue', foreground: '#1e40af', background: '#f0f9ff', accent: '#3b82f6' },
  green: { name: 'Nature Green', foreground: '#166534', background: '#f0fdf4', accent: '#22c55e' },
  purple: { name: 'Royal Purple', foreground: '#7c3aed', background: '#faf5ff', accent: '#a855f7' },
  red: { name: 'Energy Red', foreground: '#dc2626', background: '#fef2f2', accent: '#ef4444' },
  orange: { name: 'Warm Orange', foreground: '#ea580c', background: '#fff7ed', accent: '#f97316' },
  teal: { name: 'Ocean Teal', foreground: '#0f766e', background: '#f0fdfa', accent: '#14b8a6' },
  pink: { name: 'Soft Pink', foreground: '#be185d', background: '#fdf2f8', accent: '#ec4899' },
};

export async function getUserPreferences(chatId, env) {
  try {
    const data = await env.shorturl.get(`pref:${chatId}`);
    if (data) return JSON.parse(data);
  } catch {}
  return { style: 'square', colorScheme: 'classic' };
}

export async function setUserPreferences(chatId, style, colorScheme, env) {
  await env.shorturl.put(`pref:${chatId}`, JSON.stringify({ style, colorScheme }));
}
