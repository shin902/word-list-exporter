const crypto = require('crypto');

const MAX_ERROR_MESSAGE_LENGTH = parseInt(process.env.MAX_ERROR_LENGTH, 10) || 200;

/**
 * Sanitizes error messages by removing sensitive path information
 * Handles both Unix-style (/path/to/file) and Windows-style (C:\path\to\file) paths.
 *
 * Examples of paths that will be sanitized:
 * - Unix: /etc/passwd, /home/user/file.txt, /var/log/app.log
 * - Windows: C:\file.txt, C:\Windows\System32\config, D:\data\secret.json
 * - Paths with spaces: /home/user/my documents/file.txt, C:\Program Files\app\config.ini
 *
 * @param {string} message - The error message to sanitize
 * @returns {string} The sanitized message
 */
function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
        return 'An error occurred';
    }

    let sanitized = message;

    // Remove Windows paths (including single-level paths like C:\file.txt)
    // Pattern: Drive letter + colon + backslash + any valid Windows path characters
    // Examples: C:\file.txt, D:\folder\file.txt, C:\Program Files\app\config.ini
    sanitized = sanitized.replace(/[A-Za-z]:\\[\w\s\-.+\\]+/g, '[PATH]');

    // Remove Unix absolute paths
    // Pattern: Starting with / followed by path segments
    // Examples: /etc/passwd, /home/user/file.txt, /var/log/app.log
    sanitized = sanitized.replace(/\/(?:[\w\s\-.+]+\/)+[\w\s\-.+]+/g, '[PATH]');

    // Additional pattern for Unix paths with specific structure (file extension or multiple levels)
    // This catches paths that might have been missed by the previous pattern
    sanitized = sanitized.replace(/\/(?:[\w\-]+\/)+[\w\-.]+(?:\.\w+)?/g, '[PATH]');

    // Truncate long messages
    if (sanitized.length > MAX_ERROR_MESSAGE_LENGTH) {
        sanitized = sanitized.substring(0, MAX_ERROR_MESSAGE_LENGTH) + '...';
    }

    return sanitized;
}

/**
 * Returns a generic error message for common HTTP status codes
 * @param {number} status - HTTP status code
 * @returns {string|null} Generic message or null if no predefined message
 */
function getGenericMessageForStatus(status) {
    const messages = {
        400: 'リクエストが不正です。',
        401: '認証が必要です。',
        403: 'アクセスが拒否されました。',
        404: 'リソースが見つかりません。',
        413: 'リクエストのペイロードが大きすぎます。',
        429: 'リクエストが多すぎます。しばらくしてから再試行してください。',
        500: 'サーバーエラーが発生しました。',
        502: 'ゲートウェイエラーが発生しました。',
        503: 'サービスが一時的に利用できません。'
    };
    return messages[status] || null;
}

/**
 * Express error handler middleware with environment-aware error handling
 * - Development: Returns detailed error messages for debugging
 * - Production: Returns sanitized, generic messages to prevent information disclosure
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
    // Determine environment (default to production for safety)
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Generate unique error ID for debugging in all environments
    const errorId = crypto.randomUUID();

    // Helper function to send response with validation
    const sendResponse = (status, message) => {
        if (!res || typeof res.status !== 'function') {
            console.error('Invalid response object in errorHandler');
            return;
        }
        const response = { error: message };
        // Add errorId in all environments for correlation
        if (errorId) {
            response.errorId = errorId;
        }
        return res.status(status).json(response);
    };

    // Handle null/undefined errors early
    if (!err) {
        return sendResponse(500, '不明なエラーが発生しました。');
    }

    // Log detailed errors in development, but include errorId for correlation
    if (isDevelopment) {
        console.error(`Error ID ${errorId}:`, err);
    } else {
        // In production, log with error ID for correlation
        console.error(`Error ID ${errorId}:`, err?.message || 'Unknown error');
    }

    const rawMessage = err.message || 'Unknown error';

    // Gemini API error handling (keep existing Japanese messages)
    if (rawMessage.includes('Gemini API error')) {
        const statusMatch = rawMessage.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;

        if (status === 429) {
            return sendResponse(429, 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。');
        } else if (status === 401 || status === 403) {
            return sendResponse(500, 'サーバーの設定エラーです。管理者に連絡してください。');
        }
    }

    // Handle errors with status codes (from body-parser, etc.)
    if (err && (err.status || err.statusCode)) {
        const status = err.status || err.statusCode;

        // Use generic messages or sanitized messages for better security in all environments
        const messageForClient = getGenericMessageForStatus(status) || sanitizeMessage(rawMessage);
        return sendResponse(status, messageForClient);
    }

    // Default 500 error handling
    // Use generic message with error ID for debugging in all environments to prevent info disclosure
    // Sanitized messages are good for debugging without exposing paths
    return sendResponse(500, 'サーバーエラーが発生しました。しばらくしてから再試行してください。');
}

module.exports = errorHandler;
