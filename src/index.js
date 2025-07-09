import TelegramBot from 'telegram-webhook-js';

// Store user states (for multi-step interactions) 
const userStates = {};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Handle QR code image generation directly
    if (url.pathname === '/qrcode') {
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
        const bot = new TelegramBot(BOT_TOKEN);
        const updates = await request.json();
        await handleUpdate(updates, request, bot);
        return new Response('OK', { status: 200 });
    }
    
    // Handle short URL redirects
    if (url.pathname.length > 1) {
        const shortCode = url.pathname.slice(1);
        try {
            const originalUrl = await shorturl.get(shortCode);
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

// Check if URL is safe using Google Safe Browsing API
async function checkUrlSafety(url) {
    try {
        const requestBody = {
            client: {
                clientId: "url-shortener-bot",
                clientVersion: "1.0.0"
            },
            threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: [
                    { url: url }
                ]
            }
        };

        const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error('Safe Browsing API error:', response.status);
            // If API fails, we'll assume the URL is safe to not disrupt service
            return { safe: true, error: 'API error' };
        }

        const data = await response.json();
        
        // If matches is empty, the URL is safe
        return { 
            safe: !data.matches || data.matches.length === 0,
            threats: data.matches
        };
    } catch (error) {
        console.error('Error checking URL safety:', error);
        // If check fails, we'll assume the URL is safe to not disrupt service
        return { safe: true, error: error.message };
    }
}

// Generate QR code for a URL
async function generateQrCode(chatId, urlToEncode, bot) {
    try {
        // Check URL safety first
        const safetyCheck = await checkUrlSafety(urlToEncode);
        
        if (!safetyCheck.safe) {
            await bot.sendMessage(chatId, '⚠️ Warning: This URL has been identified as potentially harmful. QR code generation cancelled for your safety.');
            return;
        }
        
        // Use QR Server API directly in the Telegram API call
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
}

// Check URL and report safety status to user
async function checkAndReportUrlSafety(chatId, urlToCheck, bot) {
    try {
        await bot.sendMessage(chatId, `🔍 Checking URL safety for: ${urlToCheck}`);
        
        // Check URL safety
        const safetyCheck = await checkUrlSafety(urlToCheck);
        
        if (safetyCheck.error) {
            await bot.sendMessage(chatId, `⚠️ Warning: Could not fully verify URL safety due to an error: ${safetyCheck.error}`);
            return;
        }
        
        if (!safetyCheck.safe) {
            // Get threat details if available
            let threatDetails = '';
            if (safetyCheck.threats && safetyCheck.threats.length > 0) {
                const threatTypes = safetyCheck.threats.map(threat => threat.threatType).join(', ');
                threatDetails = `\n\nDetected threats: ${threatTypes}`;
            }
            
            await bot.sendMessage(chatId, `🚫 WARNING: This URL has been identified as potentially harmful!${threatDetails}\n\nWe recommend not visiting this website.`);
        } else {
            await bot.sendMessage(chatId, `✅ Good news! No security threats were detected for this URL.\n\nHowever, always be cautious when visiting websites and sharing personal information.`);
        }
    } catch (error) {
        console.error('Error checking URL safety:', error);
        await bot.sendMessage(chatId, 'Sorry, there was an error checking the URL safety. Please try again later.');
    }
}

// Shorten a URL and send it to the user
async function shortenAndSendUrl(chatId, originalUrl, request, bot) {
    try {
        // Check URL safety first
        const safetyCheck = await checkUrlSafety(originalUrl);
        
        if (!safetyCheck.safe) {
            await bot.sendMessage(chatId, '⚠️ Warning: This URL has been identified as potentially harmful. URL shortening cancelled for your safety.');
            return;
        }
        
        // Generate a short code
        const shortCode = generateShortCode();
        
        // Build the base URL for our service
        const requestUrl = new URL(request.url);
        const baseUrl = `${requestUrl.protocol}//${requestUrl.hostname}`;
        
        // Save the URL in KV
        await shorturl.put(shortCode, originalUrl);
        
        // Construct the shortened URL
        const shortUrl = `${baseUrl}/${shortCode}`;
        
        // Send the shortened URL
        await bot.sendMessage(chatId, `Original URL: ${originalUrl}\nShortened URL: ${shortUrl}`);
    } catch (error) {
        console.error('Error shortening URL:', error);
        await bot.sendMessage(chatId, 'Sorry, there was an error shortening your URL. Please try again later.');
    }
}

async function handleUpdate(update, request, bot) {
    try {
        const message = update.message;
        if (!message || !message.text) return;

        const chatId = message.chat.id;
        const text = message.text.trim();
    
    // Handle user in waiting-for-url state
    if (userStates[chatId]) {
        const state = userStates[chatId];
        // Clear the state
        delete userStates[chatId];
        
        if (state.waitingFor === 'qr_url') {
            if (isValidUrl(text)) {
                await generateQrCode(chatId, text, bot);
            } else {
                await bot.sendMessage(chatId, 'Please provide a valid URL. Example: https://example.com');
            }
            return;
        } else if (state.waitingFor === 'check_url') {
            if (isValidUrl(text)) {
                await checkAndReportUrlSafety(chatId, text, bot);
            } else {
                await bot.sendMessage(chatId, 'Please provide a valid URL. Example: https://example.com');
            }
            return;
        }
    }
    
    // Handle /qrcode command (replacing /qr)
    if (text === '/qrcode') {
        // Set user state to waiting for URL
        userStates[chatId] = { waitingFor: 'qr_url' };
        await bot.sendMessage(chatId, 'Please send the URL you want to convert to a QR code:');
        return;
    }
    
    // Handle /qrcode with URL
    if (text.startsWith('/qrcode ')) {
        const urlToEncode = text.slice(8).trim();
        
        if (!isValidUrl(urlToEncode)) {
            await bot.sendMessage(chatId, 'Please provide a valid URL. Example: /qrcode https://example.com');
            return;
        }
        
        await generateQrCode(chatId, urlToEncode, bot);
        return;
    }

    // Handle /checkurl command
    if (text === '/checkurl') {
        // Set user state to waiting for URL to check
        userStates[chatId] = { waitingFor: 'check_url' };
        await bot.sendMessage(chatId, 'Please send the URL you want to check for safety:');
        return;
    }
    
    // Handle /checkurl with URL
    if (text.startsWith('/checkurl ')) {
        const urlToCheck = text.slice(10).trim();
        
        if (!isValidUrl(urlToCheck)) {
            await bot.sendMessage(chatId, 'Please provide a valid URL. Example: /checkurl https://example.com');
            return;
        }
        
        await checkAndReportUrlSafety(chatId, urlToCheck, bot);
        return;
    }
    
    // URL shortening functionality
    if (isValidUrl(text)) {
        await shortenAndSendUrl(chatId, text, request, bot);
        return;
    }

    // Default responses
    if (text === '/start') {
        await bot.sendMessage(chatId, 
            'Welcome to URL Shortener & QR Code Bot!\n\n' +
            'You can:\n' +
            '• Send any URL to shorten it\n' +
            '• Use /qrcode to generate a QR code\n' +
            '• Use /checkurl to verify URL safety\n' +
            '• Use /help to see all commands'
        );
    } else if (text === '/help') {
        await bot.sendMessage(chatId, 
            'Available commands:\n' +
            '/start - Start the bot\n' +
            '/help - Show this help message\n' +
            '/qrcode - Generate a QR code for any URL\n' +
            '/checkurl - Check if a URL is safe\n' +
            'Or simply send any URL to shorten it'
        );
    } else {
        await bot.sendMessage(chatId, 'Please send a valid URL to shorten or use /qrcode to generate a QR code.');
    }
    } catch (error) {
        console.error('Error in handleUpdate:', error);
        try {
            await bot.sendMessage(update.message.chat.id, 'Sorry, an error occurred. Please try again.');
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }
}

