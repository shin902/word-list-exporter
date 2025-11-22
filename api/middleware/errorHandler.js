const crypto = require('crypto');

const MAX_ERROR_MESSAGE_LENGTH = process.env.MAX_ERROR_LENGTH || 200;

/**
 * Sanitizes error messages by removing sensitive path information
 * @param {string} message - The error message to sanitize
 * @returns {string} The sanitized message
 */
function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
        return 'An error occurred';
    }

    let sanitized = message;

    // Remove absolute paths (Unix and Windows)
    // Pattern 1: Absolute paths starting with / or C:\ etc.
    sanitized = sanitized.replace(/[A-Za-z]:\\(?:[\w\s\-.+\\]+\\)+[\w\s\-.+]+/g, '[PATH]');
    sanitized = sanitized.replace(/\/(?:[\w\s\-.+]+\/)+[\w\s\-.+]+/g, '[PATH]');

    // Pattern 2: More specific for file paths with extensions or typical directory structures
    // Only match if it looks like a real file path (has extension or multiple directory levels)
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

    // Generate unique error ID for production debugging
    const errorId = isDevelopment ? null : crypto.randomUUID();

    // Log detailed errors in development
    if (isDevelopment) {
        if (process.env.NODE_ENV !== 'development') {
            console.warn('Warning: NODE_ENV mismatch detected');
        }
        console.error('Error:', err);
    } else {
        // In production, log with error ID for correlation
        console.error(`Error ID ${errorId}:`, err?.message || 'Unknown error');
    }

    // Helper function to send response with validation
    const sendResponse = (status, message) => {
        if (!res || typeof res.status !== 'function') {
            console.error('Invalid response object in errorHandler');
            return;
        }
        const response = { error: message };
        if (errorId) {
            response.errorId = errorId;
        }
        return res.status(status).json(response);
    };

    // Handle null/undefined errors
    if (!err) {
        return sendResponse(500, '不明なエラーが発生しました。');
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

        // In production, use generic messages for better security
        // In development, show sanitized original message
        let messageForClient;
        if (isDevelopment) {
            messageForClient = rawMessage;
        } else {
            // For non-500 errors, try to use generic message first
            messageForClient = getGenericMessageForStatus(status) || sanitizeMessage(rawMessage);
        }

        return sendResponse(status, messageForClient);
    }

    // Default 500 error handling
    // Production: Generic message with error ID for debugging
    // Development: Full error details
    if (isDevelopment) {
        return sendResponse(500, rawMessage);
    } else {
        // Sanitized messages are good for debugging without exposing paths
        return sendResponse(500, 'サーバーエラーが発生しました。しばらくしてから再試行してください。');
    }
}

module.exports = errorHandler;
