const crypto = require('crypto');

/**
 * Sanitizes error messages by removing file paths and limiting length.
 * Handles both Unix-style (/path/to/file) and Windows-style (C:\path\to\file) paths.
 * @param {string} msg - The error message to sanitize
 * @returns {string} Sanitized message safe for logging and response
 */
const sanitizeMessage = (msg) => {
    if (!msg) return 'Unknown error';

    let sanitized = String(msg);

    // Redact Unix-style paths (e.g., /home/user/file.txt)
    // Look for sequences starting with / followed by alphanumeric/symbols, repeated
    sanitized = sanitized.replace(/(?:\/[a-zA-Z0-9_\-\.]+)+/g, '[PATH]');

    // Redact Windows-style paths (e.g., C:\Windows\System32 or \\server\share)
    // Drive letter: [a-zA-Z]:\
    // UNC: \\
    sanitized = sanitized.replace(/([a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+|\\\\[a-zA-Z0-9_\-\.\\]+)/g, '[PATH]');

    // Limit length to prevent huge log entries or responses
    return sanitized.substring(0, 200);
};

function errorHandler(err, req, res, next) {
    // Default to safe production mode unless explicitly 'development'
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Generate a unique ID for every error for correlation
    const errorId = crypto.randomUUID();

    // Prepare the error info
    let messageForLog;
    let messageForClient;

    if (isDevelopment) {
        messageForLog = err.message;
        // In dev, we can show the raw message to the client too
        messageForClient = err.message || 'リクエストエラーが発生しました。';
    } else {
        // Production: Sanitize everything
        const rawMessage = err.message || 'Unknown error';
        const sanitized = sanitizeMessage(rawMessage);

        messageForLog = sanitized;
        messageForClient = sanitized;
    }

    // Logging
    if (isDevelopment) {
        console.error('Error:', err);
    } else {
        console.error('Error occurred:', {
            message: messageForLog,
            status: err.status || err.statusCode || 500,
            timestamp: new Date().toISOString(),
            errorId: errorId
        });
    }

    // Response handling

    // Gemini API errors
    if (err.message && err.message.includes('Gemini API error')) {
        const statusMatch = err.message.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;

        if (status === 429) {
            return res.status(429).json({
                error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。',
                errorId: isDevelopment ? undefined : errorId
            });
        } else if (status === 401 || status === 403) {
            return res.status(500).json({
                error: 'サーバーの設定エラーです。管理者に連絡してください。',
                errorId: isDevelopment ? undefined : errorId
            });
        }
    }

    // Standard status code errors (body-parser, explicit throws)
    if (err.status || err.statusCode) {
        const status = err.status || err.statusCode;
        return res.status(status).json({
            error: messageForClient,
            errorId: isDevelopment ? undefined : errorId
        });
    }

    // Default 500 error
    res.status(500).json({
        error: isDevelopment ? (err.message || 'サーバーエラーが発生しました。') : 'サーバーエラーが発生しました。しばらくしてから再試行してください。',
        errorId: isDevelopment ? undefined : errorId
    });
}

module.exports = errorHandler;
