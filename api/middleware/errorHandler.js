const crypto = require('crypto');

const MAX_ERROR_MESSAGE_LENGTH = 200;

/**
 * Sanitizes error messages by removing file paths and limiting length.
 * Handles both Unix-style (/path/to/file) and Windows-style (C:\path\to\file) paths.
 * @param {string} msg - The error message to sanitize
 * @returns {string} Sanitized message safe for logging and response
 */
const sanitizeMessage = (msg) => {
    if (!msg) return 'Unknown error';

    let sanitized = String(msg);

    // Redact Unix-style paths
    // Strategy: Match sequences starting with '/' that look like paths.
    // To avoid false positives (e.g. dates "5/10", ratios), we require at least 2 segments
    // e.g. /usr/bin, /home/user, /var/log/file.txt
    // OR starting with common root folders followed by a slash
    sanitized = sanitized.replace(/(?:^|[\s(])(\/(?:usr|bin|home|var|etc|opt|tmp|root|Users|Program\sFiles)\/[\w\-.+\s\/]+)/g, ' [PATH]');

    // Also catch generic paths with at least 2 levels of depth to catch others
    // e.g. /app/src/file.js
    sanitized = sanitized.replace(/(\/[\w\-.+]+\/[\w\-.+\/]+)/g, '[PATH]');

    // Redact Windows-style paths (e.g., C:\Windows\System32 or \\server\share)
    // Drive letter: [a-zA-Z]:\ followed by valid path chars
    // UNC: \\ followed by valid path chars
    sanitized = sanitized.replace(/([a-zA-Z]:\\[\w\-.+\s\(\)\+\\]+|\\\\[\w\-.+\s\(\)\+\\]+)/g, '[PATH]');

    // Limit length to prevent huge log entries or responses
    if (sanitized.length > MAX_ERROR_MESSAGE_LENGTH) {
        return sanitized.substring(0, MAX_ERROR_MESSAGE_LENGTH - 3) + '...';
    }
    return sanitized;
};

/**
 * Global error handling middleware.
 * Handles logging and sending appropriate error responses to the client.
 * In production, it sanitizes error messages to prevent information disclosure.
 *
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
    // Default to safe production mode unless explicitly 'development'
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Generate a unique ID for correlation (only in production to save resources)
    const errorId = isDevelopment ? undefined : crypto.randomUUID();

    // Prepare the error info
    let messageForLog;
    let messageForClient;

    const rawMessage = (err && err.message) ? err.message : 'Unknown error';

    if (isDevelopment) {
        messageForLog = rawMessage;
        messageForClient = rawMessage;
    } else {
        // Production: Sanitize everything
        const sanitized = sanitizeMessage(rawMessage);

        messageForLog = sanitized;
        // For consistency, we use the sanitized message for client responses by default
        // unless it's a 500 error where we might want to be even more generic.
        messageForClient = sanitized;
    }

    // Logging
    if (isDevelopment) {
        console.error('Error:', err);
    } else {
        // In production, we log the sanitized message.
        // Ideally, we would log the full message to a secure, private log stream
        // and the sanitized one to the console/standard output if it might be exposed.
        // Assuming console.error might be exposed or is the only log, we stick to sanitized.
        console.error('Error occurred:', {
            message: messageForLog,
            status: err ? (err.status || err.statusCode || 500) : 500,
            timestamp: new Date().toISOString(),
            errorId: errorId
        });
    }

    // Helper to send JSON response
    const sendResponse = (status, message) => {
        const response = { error: message };
        if (errorId) {
            response.errorId = errorId;
        }
        return res.status(status).json(response);
    };

    // Gemini API errors
    // Note: We check rawMessage for logic, but response/logs use sanitized values in production
    if (rawMessage.includes('Gemini API error')) {
        const statusMatch = rawMessage.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;

        if (status === 429) {
            return sendResponse(429, 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。');
        } else if (status === 401 || status === 403) {
            return sendResponse(500, 'サーバーの設定エラーです。管理者に連絡してください。');
        }
    }

    // Standard status code errors (body-parser, explicit throws)
    if (err && (err.status || err.statusCode)) {
        const status = err.status || err.statusCode;
        return sendResponse(status, messageForClient);
    }

    // Default 500 error
    // For 500 errors in production, we use a generic message to be absolutely safe and consistent.
    // Sanitzed messages are good, but "Internal Server Error" is better for 500s.
    const finalMessage = isDevelopment ? messageForClient : 'サーバーエラーが発生しました。しばらくしてから再試行してください。';

    sendResponse(500, finalMessage);
}

module.exports = errorHandler;
