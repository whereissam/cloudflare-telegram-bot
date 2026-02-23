import { COLOR_SCHEMES, QR_STYLES } from './preferences.js';

// Generate styled QR code and send via Telegram
export async function generateAdvancedQrCode(chatId, urlToEncode, bot, env, style = 'square', colorScheme = 'classic') {
  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.classic;
  const fgColor = colors.foreground.replace('#', '');
  const bgColor = colors.background.replace('#', '');

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(urlToEncode)}&color=${fgColor}&bgcolor=${bgColor}`;

  const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: qrApiUrl,
      caption: `${QR_STYLES[style]?.name || 'Custom'} QR Code\nColors: ${COLOR_SCHEMES[colorScheme]?.name || 'Custom'}\nURL: ${urlToEncode}`,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || 'Failed to send QR code');
  }
}

// Basic QR code generation (fallback)
export async function generateBasicQrCode(chatId, urlToEncode, bot) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(urlToEncode)}`;

  const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: qrApiUrl,
      caption: `QR code for: ${urlToEncode}`,
    }),
  });

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.description || 'Unknown error');
  }
}
