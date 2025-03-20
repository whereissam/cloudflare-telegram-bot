import TelegramBot from 'telegram-webhook-js';

const bot = new TelegramBot("your_telegram_bot_token");

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Handle incoming webhook updates
    if (url.pathname === '/webhook') {
        const updates = await request.json();
        await bot.handleUpdate(updates, request); // Pass request to handleUpdate
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
    
    // Automatically set the webhook
    await bot.setWebhook(`https://${url.hostname}/webhook`);
    return new Response('Webhook set', { status: 200 });
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

// Check if a string is a valid URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function handleUpdate(update, request) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const lowerText = text.toLowerCase();

    if (lowerText === '/start') {
        await bot.sendMessage(chatId, 'Welcome to URL Shortener Bot! Send me any URL and I will shorten it for you. Use /help to see all commands.');
    } else if (lowerText === '/help') {
        await bot.sendMessage(chatId, 
            'Available commands:\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            'Or simply send any URL to shorten it');
    } else if (isValidUrl(text)) {
        try {
            // Generate a short code
            const shortCode = generateShortCode();
            
            // Save the URL in KV
            await shortener.put(shortCode, text);
            
            // Construct the shortened URL - THIS IS THE FIX
            const requestUrl = new URL(request.url);
            const baseUrl = `${requestUrl.protocol}//${requestUrl.hostname}`;
            const shortUrl = `${baseUrl}/${shortCode}`;
            
            await bot.sendMessage(chatId, `Original URL: ${text}\nShortened URL: ${shortUrl}`);
        } catch (error) {
            console.error('Error shortening URL:', error);
            await bot.sendMessage(chatId, 'Sorry, there was an error shortening your URL. Please try again later.');
        }
    } else {
        await bot.sendMessage(chatId, 'Please send a valid URL to shorten. Use /help to see all commands.');
    }
}

// A simple modification to pass the request object to handleUpdate
bot.handleUpdate = async function(update, request) {
    return handleUpdate(update, request);
};