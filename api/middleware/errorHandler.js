const crypto = require('crypto');


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
 * Express error handler middleware with secure error handling.
 * - All environments: Returns generic messages to prevent information disclosure.
 * - Detailed errors are logged server-side only with a unique errorId for correlation.
 *
 * @example
 * // Final response format:
 * {
 *   "error": "サーバーエラーが発生しました。",
 *   "errorId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
 * }
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
    // Generate unique error ID for debugging in all environments
    const errorId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

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
        console.error(`Error ID ${errorId} [${timestamp}]:`, {
            message: 'Unknown error (null/undefined)',
            timestamp
        });
        return sendResponse(500, '不明なエラーが発生しました。');
    }

    // Log detailed errors server-side for all environments
    // This includes stack trace for debugging but never exposes it to client
    console.error(`Error ID ${errorId} [${timestamp}]:`, {
        message: err?.message || 'Unknown error',
        stack: err?.stack,
        name: err?.name,
        status: err?.status || err?.statusCode,
        timestamp
    });

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

    // Handle other errors with status codes
    if (err && (err.status || err.statusCode)) {
        const status = err.status || err.statusCode;

        // In all environments, prioritize generic messages to prevent information disclosure.
        const messageForClient = getGenericMessageForStatus(status) || 'サーバーエラーが発生しました。しばらくしてから再試行してください。';
        return sendResponse(status, messageForClient);
    }

    // Default 500 error handling
    // Use generic message with error ID for debugging in all environments to prevent info disclosure
    // Sanitized messages are good for debugging without exposing paths
    return sendResponse(500, 'サーバーエラーが発生しました。しばらくしてから再試行してください。');
}

module.exports = errorHandler;
