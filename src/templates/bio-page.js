import { escapeHtml } from '../utils/helpers.js';

const THEMES = {
  light: {
    bg: '#ffffff',
    card: '#f9fafb',
    text: '#111827',
    subtext: '#6b7280',
    accent: '#2563eb',
    border: '#e5e7eb',
  },
  dark: {
    bg: '#111827',
    card: '#1f2937',
    text: '#f9fafb',
    subtext: '#9ca3af',
    accent: '#60a5fa',
    border: '#374151',
  },
  gradient: {
    bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    card: 'rgba(255,255,255,0.15)',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.8)',
    accent: '#ffffff',
    border: 'rgba(255,255,255,0.2)',
  },
  minimal: {
    bg: '#fafafa',
    card: 'transparent',
    text: '#1a1a1a',
    subtext: '#888888',
    accent: '#1a1a1a',
    border: '#e0e0e0',
  },
};

export function renderBioPage(page, code) {
  const theme = THEMES[page.theme] || THEMES.light;
  const title = escapeHtml(page.title || 'My Links');
  const description = escapeHtml(page.description || '');
  const buttons = (page.buttons || [])
    .map(
      b =>
        `<a href="${escapeHtml(b.url)}" class="btn" target="_blank" rel="noopener">${escapeHtml(b.label)}</a>`
    )
    .join('\n      ');

  const bgStyle = theme.bg.startsWith('linear')
    ? `background: ${theme.bg}`
    : `background-color: ${theme.bg}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="profile">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      ${bgStyle};
      color: ${theme.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    h1 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    .desc {
      color: ${theme.subtext};
      margin-bottom: 2rem;
      font-size: 1rem;
      line-height: 1.5;
    }
    .btn {
      display: block;
      padding: 0.875rem 1.5rem;
      margin-bottom: 0.75rem;
      background: ${theme.card};
      color: ${theme.accent};
      text-decoration: none;
      border-radius: 12px;
      border: 1px solid ${theme.border};
      font-size: 1rem;
      font-weight: 500;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .footer {
      margin-top: 2rem;
      color: ${theme.subtext};
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    ${description ? `<p class="desc">${description}</p>` : ''}
    <div class="links">
      ${buttons || '<p style="opacity:0.5">No links yet</p>'}
    </div>
    <p class="footer">Powered by Link Hub Bot</p>
  </div>
</body>
</html>`;
}
