import TelegramBot from 'telegram-webhook-js';

const bot = new TelegramBot("your_telegram_bot_token");

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Handle QR code image generation directly
    if (url.pathname === '/qr') {
        try {
            const urlToEncode = url.searchParams.get('url');
            if (!urlToEncode) {
                return new Response('URL parameter is required', { status: 400 });
            }
            
            // Use a third-party QR code service that's reliable with Telegram
            // QR Server API returns PNG directly
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlToEncode)}`;
            
            // Fetch the QR code from the external service
            const response = await fetch(qrImageUrl);
            if (!response.ok) {
                throw new Error(`Failed to generate QR code: ${response.status}`);
            }
            
            // Return the image with appropriate headers
            return new Response(response.body, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
            return new Response(`Error generating QR code: ${error.message}`, { 
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    }
    
    // Handle incoming webhook updates
    if (url.pathname === '/webhook') {
        const updates = await request.json();
        await bot.handleUpdate(updates, request);
        return new Response('OK', { status: 200 });
    }
    
    // Handle short URL redirects
    if (url.pathname.length > 1) {
        const shortCode = url.pathname.slice(1);
        try {
            const originalUrl = await shortener.get(shortCode);
            if (originalUrl) {
                return Response.redirect(originalUrl, 301);
            }
        } catch (error) {
            console.error('Error retrieving shortened URL:', error);
        }
    }
    
    // Default response
    return new Response('URL Shortener and QR Code Generator', { status: 200 });
}

// Check if a string is a valid URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Generate a random short code
function generateShortCode(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

async function handleUpdate(update, request) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    
    // Build the base URL for our service
    const requestUrl = new URL(request.url);
    const baseUrl = `${requestUrl.protocol}//${requestUrl.hostname}`;

    // Handle /qr command
    if (text.startsWith('/qr ')) {
        const urlToEncode = text.slice(4).trim();
        
        if (!isValidUrl(urlToEncode)) {
            await bot.sendMessage(chatId, 'Please provide a valid URL. Example: /qr https://example.com');
            return;
        }
        
        try {
            // Instead of using our QR endpoint, use QR Server API directly in the Telegram API call
            const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlToEncode)}`;
            
            // Directly send the message to Telegram API
            const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    photo: qrApiUrl,
                    caption: `QR code for: ${urlToEncode}`
                })
            });
            
            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.description || 'Unknown error');
            }
        } catch (error) {
            console.error('Failed to send QR code:', error);
            await bot.sendMessage(chatId, 'Error generating QR code. Please try again later.');
        }
        return;
    }
    
    // Handle just /qr (without URL)
    if (text === '/qr') {
        await bot.sendMessage(chatId, 'Please use the format: /qr https://example.com');
        return;
    }

    // URL shortening functionality
    if (isValidUrl(text)) {
        try {
            // Generate a short code
            const shortCode = generateShortCode();
            
            // Save the URL in KV
            await shortener.put(shortCode, text);
            
            // Construct the shortened URL
            const shortUrl = `${baseUrl}/${shortCode}`;
            
            // Send the shortened URL
            await bot.sendMessage(chatId, `Original URL: ${text}\nShortened URL: ${shortUrl}`);
        } catch (error) {
            console.error('Error shortening URL:', error);
            await bot.sendMessage(chatId, 'Sorry, there was an error shortening your URL. Please try again later.');
        }
        return;
    }

    // Default responses
    if (text === '/start') {
        await bot.sendMessage(chatId, 
            'Welcome to URL Shortener & QR Code Bot!\n\n' +
            'You can:\n' +
            '• Send any URL to shorten it\n' +
            '• Use /qr [URL] to generate a QR code\n' +
            '• Use /help to see all commands'
        );
    } else if (text === '/help') {
        await bot.sendMessage(chatId, 
            'Available commands:\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '/qr [URL] - Generate a QR code for any URL\n' +
            'Or simply send any URL to shorten it'
        );
    } else {
        await bot.sendMessage(chatId, 'Please send a valid URL to shorten or use /qr [URL] to generate a QR code.');
    }
}

// A simple modification to pass the request object to handleUpdate
bot.handleUpdate = async function(update, request) {
    return handleUpdate(update, request);
};