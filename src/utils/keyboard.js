import { QR_STYLES, COLOR_SCHEMES } from './preferences.js';

// Inline keyboard after creating a short link
export function shortLinkKeyboard(code, shortUrl) {
  return {
    inline_keyboard: [
      [
        { text: 'QR Code', callback_data: `qr:${code}` },
        { text: 'Stats', callback_data: `stats:${code}` },
        { text: 'Expire', callback_data: `expire:${code}` },
      ],
      [
        { text: 'Open Link', url: shortUrl },
      ],
    ],
  };
}

// Inline keyboard after creating a bio page
export function bioKeyboard(code, pageUrl) {
  return {
    inline_keyboard: [
      [
        { text: 'View Page', url: pageUrl },
        { text: 'Edit', callback_data: `edit:${code}` },
      ],
      [
        { text: 'Stats', callback_data: `stats:${code}` },
        { text: 'Share', callback_data: `share:${code}` },
      ],
    ],
  };
}

// QR style picker keyboard
export function qrStyleKeyboard() {
  return {
    inline_keyboard: Object.entries(QR_STYLES).map(([key, style]) => [
      { text: style.name, callback_data: `style:${key}` },
    ]),
  };
}

// QR color picker keyboard
export function qrColorKeyboard() {
  const entries = Object.entries(COLOR_SCHEMES);
  const rows = [];
  for (let i = 0; i < entries.length; i += 2) {
    const row = [{ text: entries[i][1].name, callback_data: `color:${entries[i][0]}` }];
    if (entries[i + 1]) {
      row.push({ text: entries[i + 1][1].name, callback_data: `color:${entries[i + 1][0]}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

// Help categories keyboard
export function helpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'URL Operations', callback_data: 'help:urls' },
        { text: 'QR Codes', callback_data: 'help:qr' },
      ],
      [
        { text: 'Analytics', callback_data: 'help:analytics' },
        { text: 'Link-in-Bio', callback_data: 'help:bio' },
      ],
      [
        { text: 'Link Management', callback_data: 'help:manage' },
        { text: 'Workspace', callback_data: 'help:workspace' },
      ],
    ],
  };
}

// Edit bio keyboard
export function editBioKeyboard(code) {
  return {
    inline_keyboard: [
      [
        { text: 'Edit Title', callback_data: `edit:${code}:title` },
        { text: 'Edit Description', callback_data: `edit:${code}:desc` },
      ],
      [
        { text: 'Add Link', callback_data: `edit:${code}:addlink` },
        { text: 'Remove Link', callback_data: `edit:${code}:rmlink` },
      ],
      [
        { text: 'Delete', callback_data: `confirm_delete:${code}` },
      ],
    ],
  };
}

// Confirm delete keyboard
export function confirmDeleteKeyboard(code) {
  return {
    inline_keyboard: [
      [
        { text: 'Yes, Delete', callback_data: `do_delete:${code}` },
        { text: 'Cancel', callback_data: 'cancel' },
      ],
    ],
  };
}

// Expire duration picker keyboard
export function expireKeyboard(code) {
  return {
    inline_keyboard: [
      [
        { text: '30 min', callback_data: `set_expire:${code}:30m` },
        { text: '2 hours', callback_data: `set_expire:${code}:2h` },
        { text: '1 day', callback_data: `set_expire:${code}:1d` },
      ],
      [
        { text: '7 days', callback_data: `set_expire:${code}:7d` },
        { text: '30 days', callback_data: `set_expire:${code}:30d` },
        { text: 'Cancel', callback_data: 'cancel' },
      ],
    ],
  };
}

// Safety warning with confirm button
export function safetyWarningKeyboard(code) {
  return {
    inline_keyboard: [
      [
        { text: 'Shorten Anyway', callback_data: `force_shorten:${code}` },
        { text: 'Cancel', callback_data: 'cancel' },
      ],
    ],
  };
}
