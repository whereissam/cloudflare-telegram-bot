export function renderExpiredPage(code, clickLimitReached = false) {
  const reason = clickLimitReached
    ? 'This link has reached its maximum number of uses.'
    : 'This link has expired and is no longer available.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Link Expired</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #f9fafb;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      max-width: 420px;
      text-align: center;
      background: #fff;
      padding: 2.5rem;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">410</div>
    <h1>Link Gone</h1>
    <p>${reason}</p>
  </div>
</body>
</html>`;
}
