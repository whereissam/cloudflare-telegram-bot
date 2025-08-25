import TelegramBot from 'telegram-webhook-js';
import QRCodeStyling from 'qr-code-styling';

// Store user states (for multi-step interactions) 
const userStates = {};

// QR Code styling options
const QR_STYLES = {
    square: { name: '🔲 Classic Square', value: 'square' },
    rounded: { name: '🔘 Rounded Corners', value: 'rounded' },
    dots: { name: '⚪ Circular Dots', value: 'dots' }
};

const COLOR_SCHEMES = {
    classic: { name: '⚫ Classic (Black & White)', foreground: '#000000', background: '#ffffff' },
    blue: { name: '🔵 Business Blue', foreground: '#1e40af', background: '#f0f9ff', accent: '#3b82f6' },
    green: { name: '🟢 Nature Green', foreground: '#166534', background: '#f0fdf4', accent: '#22c55e' },
    purple: { name: '🟣 Royal Purple', foreground: '#7c3aed', background: '#faf5ff', accent: '#a855f7' },
    red: { name: '🔴 Energy Red', foreground: '#dc2626', background: '#fef2f2', accent: '#ef4444' },
    orange: { name: '🟠 Warm Orange', foreground: '#ea580c', background: '#fff7ed', accent: '#f97316' },
    teal: { name: '🔵 Ocean Teal', foreground: '#0f766e', background: '#f0fdfa', accent: '#14b8a6' },
    pink: { name: '🩷 Soft Pink', foreground: '#be185d', background: '#fdf2f8', accent: '#ec4899' }
};

// User preferences storage
const userPreferences = {};

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

// Get QR code configuration based on style and colors
function getQRCodeConfig(style, colorScheme, url, size = 512) {
    const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.classic;
    
    const baseConfig = {
        width: size,
        height: size,
        margin: 10,
        data: url,
        qrOptions: {
            typeNumber: 0,
            mode: 'Byte',
            errorCorrectionLevel: 'M'
        },
        backgroundOptions: {
            color: colors.background
        }
    };

    switch (style) {
        case 'rounded':
            return {
                ...baseConfig,
                dotsOptions: {
                    color: colors.foreground,
                    type: 'rounded'
                },
                cornersSquareOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'extra-rounded'
                },
                cornersDotOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'dot'
                }
            };
        case 'dots':
            return {
                ...baseConfig,
                dotsOptions: {
                    color: colors.foreground,
                    type: 'dots'
                },
                cornersSquareOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'extra-rounded'
                },
                cornersDotOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'dot'
                }
            };
        default: // square
            return {
                ...baseConfig,
                dotsOptions: {
                    color: colors.foreground,
                    type: 'square'
                },
                cornersSquareOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'square'
                },
                cornersDotOptions: {
                    color: colors.accent || colors.foreground,
                    type: 'square'
                }
            };
    }
}

// Generate advanced QR code
async function generateAdvancedQrCode(chatId, urlToEncode, bot, style = 'square', colorScheme = 'classic') {
    try {
        // Check URL safety first
        const safetyCheck = await checkUrlSafety(urlToEncode);
        
        if (!safetyCheck.safe) {
            await bot.sendMessage(chatId, '⚠️ Warning: This URL has been identified as potentially harmful. QR code generation cancelled for your safety.');
            return;
        }

        const config = getQRCodeConfig(style, colorScheme, urlToEncode);
        const qrCode = new QRCodeStyling(config);
        
        // Generate QR code as buffer
        const qrBuffer = await qrCode.getRawData('png');
        
        if (!qrBuffer) {
            throw new Error('Failed to generate QR code buffer');
        }

        // Convert buffer to base64 for Telegram
        const base64QR = Buffer.from(qrBuffer).toString('base64');
        const dataUri = `data:image/png;base64,${base64QR}`;
        
        // Send to Telegram
        const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                photo: dataUri,
                caption: `🎨 ${QR_STYLES[style]?.name || 'Custom'} QR Code\n🎨 Style: ${COLOR_SCHEMES[colorScheme]?.name || 'Custom Colors'}\n🔗 URL: ${urlToEncode}`
            })
        });
        
        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.description || 'Failed to send QR code');
        }
        
    } catch (error) {
        console.error('Failed to generate advanced QR code:', error);
        await bot.sendMessage(chatId, '❌ Error generating styled QR code. Falling back to basic version...');
        
        // Fallback to basic QR code
        await generateBasicQrCode(chatId, urlToEncode, bot);
    }
}

// Basic QR code generation (fallback)
async function generateBasicQrCode(chatId, urlToEncode, bot) {
    try {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(urlToEncode)}`;
        
        const response = await fetch(`https://api.telegram.org/bot${bot.token}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                photo: qrApiUrl,
                caption: `📱 Basic QR code for: ${urlToEncode}`
            })
        });
        
        const result = await response.json();
        if (!result.ok) {
            throw new Error(result.description || 'Unknown error');
        }
    } catch (error) {
        console.error('Failed to send basic QR code:', error);
        await bot.sendMessage(chatId, '❌ Error generating QR code. Please try again later.');
    }
}

// Get user preferences
function getUserPreferences(chatId) {
    return userPreferences[chatId] || { style: 'square', colorScheme: 'classic' };
}

// Set user preferences
function setUserPreferences(chatId, style, colorScheme) {
    userPreferences[chatId] = { style, colorScheme };
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
                const prefs = getUserPreferences(chatId);
                await generateAdvancedQrCode(chatId, text, bot, prefs.style, prefs.colorScheme);
            } else {
                await bot.sendMessage(chatId, 'Please provide a valid URL. Example: https://example.com');
            }
            return;
        } else if (state.waitingFor === 'qr_style') {
            const styleKey = text.toLowerCase();
            if (QR_STYLES[styleKey]) {
                const prefs = getUserPreferences(chatId);
                setUserPreferences(chatId, styleKey, prefs.colorScheme);
                await bot.sendMessage(chatId, `✅ QR code style set to: ${QR_STYLES[styleKey].name}\\nNow send a URL or use /qrcode to generate a styled QR code!`);
            } else {
                await bot.sendMessage(chatId, '❌ Invalid style. Please choose: square, rounded, or dots');
            }
            return;
        } else if (state.waitingFor === 'qr_color') {
            const colorKey = text.toLowerCase();
            if (COLOR_SCHEMES[colorKey]) {
                const prefs = getUserPreferences(chatId);
                setUserPreferences(chatId, prefs.style, colorKey);
                await bot.sendMessage(chatId, `🎨 QR code color scheme set to: ${COLOR_SCHEMES[colorKey].name}\\nNow send a URL or use /qrcode to generate a styled QR code!`);
            } else {
                await bot.sendMessage(chatId, '❌ Invalid color scheme. Please choose from: classic, blue, green, purple, red, orange, teal, pink');
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
        
        const prefs = getUserPreferences(chatId);
        await generateAdvancedQrCode(chatId, urlToEncode, bot, prefs.style, prefs.colorScheme);
        return;
    }

    // Handle QR code style setting
    if (text === '/qrstyle' || text === '/qr_style') {
        userStates[chatId] = { waitingFor: 'qr_style' };
        let styleList = '';
        Object.entries(QR_STYLES).forEach(([key, style]) => {
            styleList += `• *${key}* - ${style.name}\\n`;
        });
        await bot.sendMessage(chatId, `🎨 Choose your QR code style:\\n\\n${styleList}\\nSend the style name (e.g., "rounded"):`, { parse_mode: 'Markdown' });
        return;
    }

    // Handle QR code color setting
    if (text === '/qrcolor' || text === '/qr_color') {
        userStates[chatId] = { waitingFor: 'qr_color' };
        let colorList = '';
        Object.entries(COLOR_SCHEMES).forEach(([key, scheme]) => {
            colorList += `• *${key}* - ${scheme.name}\\n`;
        });
        await bot.sendMessage(chatId, `🌈 Choose your QR code color scheme:\\n\\n${colorList}\\nSend the scheme name (e.g., "blue"):`, { parse_mode: 'Markdown' });
        return;
    }

    // Handle QR settings display
    if (text === '/qrsettings' || text === '/qr_settings') {
        const prefs = getUserPreferences(chatId);
        const currentStyle = QR_STYLES[prefs.style]?.name || 'Unknown';
        const currentColor = COLOR_SCHEMES[prefs.colorScheme]?.name || 'Unknown';
        
        await bot.sendMessage(chatId, 
            `⚙️ *Your Current QR Settings:*\\n\\n` +
            `🎨 Style: ${currentStyle}\\n` +
            `🌈 Colors: ${currentColor}\\n\\n` +
            `Use /qrstyle to change style\\n` +
            `Use /qrcolor to change colors`, 
            { parse_mode: 'Markdown' }
        );
        return;
    }

    // Handle preview of all styles
    if (text === '/qrpreview') {
        const sampleUrl = 'https://telegram.org';
        await bot.sendMessage(chatId, '🔮 Generating style previews... This may take a moment!');
        
        // Generate preview for each style with current color scheme
        const prefs = getUserPreferences(chatId);
        
        for (const [styleKey, styleInfo] of Object.entries(QR_STYLES)) {
            try {
                await generateAdvancedQrCode(chatId, sampleUrl, bot, styleKey, prefs.colorScheme);
                await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between sends
            } catch (error) {
                console.error(`Preview failed for ${styleKey}:`, error);
            }
        }
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
            '🤖 *Welcome to Enhanced URL Shortener & QR Code Bot!*\\n\\n' +
            '✨ *Features:*\\n' +
            '• 📎 Send any URL to shorten it\\n' +
            '• 🎨 Generate styled QR codes with custom colors & shapes\\n' +
            '• 🛡️ URL safety checking\\n' +
            '• 🎭 Multiple QR code styles (square, rounded, dots)\\n' +
            '• 🌈 8 beautiful color schemes\\n\\n' +
            '🚀 *Quick Start:*\\n' +
            '• Use /qrcode to create styled QR codes\\n' +
            '• Use /qrsettings to customize your style\\n' +
            '• Use /help for all commands',
            { parse_mode: 'Markdown' }
        );
    } else if (text === '/help') {
        await bot.sendMessage(chatId, 
            '📖 *Available Commands:*\\n\\n' +
            '🔗 *URL Operations:*\\n' +
            '• /qrcode - Generate styled QR code\\n' +
            '• /checkurl - Check URL safety\\n' +
            '• Send any URL to shorten it\\n\\n' +
            '🎨 *QR Code Customization:*\\n' +
            '• /qrstyle - Change QR code style\\n' +
            '• /qrcolor - Change color scheme\\n' +
            '• /qrsettings - View current settings\\n' +
            '• /qrpreview - Preview all styles\\n\\n' +
            '💡 *Tips:*\\n' +
            '• Use /qrcode <url> for instant generation\\n' +
            '• Customize once, use forever!\\n' +
            '• All QR codes include URL safety checks',
            { parse_mode: 'Markdown' }
        );
    } else {
        await bot.sendMessage(chatId, '🤔 I didn\'t understand that. Send a URL to shorten it, or use /help to see all available commands!', { parse_mode: 'Markdown' });
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

