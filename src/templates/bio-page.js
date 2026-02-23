import { escapeHtml } from '../utils/helpers.js';

const THEMES = {
  light: {
    bg: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    subtext: '#64748b',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    border: '#e2e8f0',
    avatarBg: '#e0e7ff',
    avatarText: '#3730a3',
    glow: 'rgba(37,99,235,0.08)',
  },
  dark: {
    bg: '#0b0f1a',
    card: '#151c2c',
    text: '#f1f5f9',
    subtext: '#94a3b8',
    accent: '#818cf8',
    accentHover: '#a5b4fc',
    border: '#1e293b',
    avatarBg: '#312e81',
    avatarText: '#c7d2fe',
    glow: 'rgba(129,140,248,0.1)',
  },
  gradient: {
    bg: 'linear-gradient(150deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    card: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    subtext: 'rgba(255,255,255,0.7)',
    accent: '#c4b5fd',
    accentHover: '#ddd6fe',
    border: 'rgba(255,255,255,0.12)',
    avatarBg: 'rgba(196,181,253,0.2)',
    avatarText: '#c4b5fd',
    glow: 'rgba(196,181,253,0.08)',
  },
  minimal: {
    bg: '#ffffff',
    card: '#ffffff',
    text: '#18181b',
    subtext: '#71717a',
    accent: '#18181b',
    accentHover: '#3f3f46',
    border: '#e4e4e7',
    avatarBg: '#f4f4f5',
    avatarText: '#3f3f46',
    glow: 'rgba(0,0,0,0.03)',
  },
};

// Extract initials from title
function getInitials(title) {
  if (!title) return '?';
  const words = title.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

// Detect link type for icon
function getLinkIcon(url, label) {
  const lower = (url + ' ' + label).toLowerCase();
  if (lower.includes('github')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>';
  if (lower.includes('twitter') || lower.includes('x.com')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  if (lower.includes('linkedin')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
  if (lower.includes('instagram')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>';
  if (lower.includes('youtube')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>';
  if (lower.includes('telegram') || lower.includes('t.me')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
  if (lower.includes('discord')) return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>';
  if (lower.includes('website') || lower.includes('blog') || lower.includes('portfolio')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>';
  if (lower.includes('email') || lower.includes('mail')) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  // Default link icon
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>';
}

export function renderBioPage(page, code) {
  const theme = THEMES[page.theme] || THEMES.dark;
  const title = escapeHtml(page.title || 'My Links');
  const description = escapeHtml(page.description || '');
  const initials = getInitials(page.title);
  const buttonCount = (page.buttons || []).length;

  const buttons = (page.buttons || [])
    .map(b => {
      const icon = getLinkIcon(b.url, b.label);
      return `<a href="${escapeHtml(b.url)}" class="btn" target="_blank" rel="noopener">
        <span class="btn-icon">${icon}</span>
        <span class="btn-label">${escapeHtml(b.label)}</span>
        <span class="btn-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg></span>
      </a>`;
    })
    .join('\n');

  const bgStyle = theme.bg.startsWith('linear')
    ? `background: ${theme.bg}`
    : `background-color: ${theme.bg}`;

  const isGradient = theme.bg.startsWith('linear');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description || title + ' - Link Hub'}">
  <meta property="og:type" content="profile">
  <meta name="theme-color" content="${isGradient ? '#302b63' : theme.bg}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      ${bgStyle};
      ${isGradient ? 'background-attachment: fixed;' : ''}
      color: ${theme.text};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 3rem 1.25rem;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 440px;
      width: 100%;
      animation: fadeUp 0.5s ease-out;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Avatar */
    .avatar {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: ${theme.avatarBg};
      color: ${theme.avatarText};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      margin: 0 auto 1.25rem;
      letter-spacing: -0.02em;
      ${isGradient ? 'backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);' : ''}
      box-shadow: 0 0 0 3px ${theme.glow}, 0 4px 24px ${theme.glow};
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 1.625rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }

    .desc {
      color: ${theme.subtext};
      margin-top: 0.5rem;
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    .meta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 0.75rem;
      color: ${theme.subtext};
      font-size: 0.8125rem;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .meta-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: ${theme.subtext};
      opacity: 0.5;
    }

    /* Links */
    .links {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.9375rem 1.125rem;
      background: ${theme.card};
      color: ${theme.text};
      text-decoration: none;
      border-radius: 14px;
      border: 1px solid ${theme.border};
      font-size: 0.9375rem;
      font-weight: 500;
      transition: all 0.2s ease;
      ${isGradient ? 'backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);' : ''}
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px ${theme.glow};
      border-color: ${theme.accent};
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: ${theme.glow};
      color: ${theme.accent};
      flex-shrink: 0;
    }

    .btn-label {
      flex: 1;
      text-align: left;
    }

    .btn-arrow {
      color: ${theme.subtext};
      opacity: 0;
      transform: translateX(-4px);
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .btn:hover .btn-arrow {
      opacity: 1;
      transform: translateX(0);
    }

    /* Empty state */
    .empty {
      text-align: center;
      padding: 2rem;
      color: ${theme.subtext};
      font-size: 0.875rem;
      border: 1px dashed ${theme.border};
      border-radius: 14px;
    }

    /* Footer */
    .footer {
      margin-top: 2.5rem;
      text-align: center;
      color: ${theme.subtext};
      font-size: 0.6875rem;
      opacity: 0.6;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .footer a {
      color: inherit;
      text-decoration: none;
    }

    /* Mobile tweaks */
    @media (max-width: 480px) {
      body { padding: 2rem 1rem; }
      .avatar { width: 72px; height: 72px; font-size: 1.625rem; }
      h1 { font-size: 1.375rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="avatar">${initials}</div>
      <h1>${title}</h1>
      ${description ? `<p class="desc">${description}</p>` : ''}
      <div class="meta">
        <span class="meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          ${buttonCount} link${buttonCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
    <div class="links">
      ${buttons || '<div class="empty">No links added yet</div>'}
    </div>
    <p class="footer"><a href="#">Link Hub</a></p>
  </div>
</body>
</html>`;
}
