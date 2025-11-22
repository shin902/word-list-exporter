const crypto = require('crypto');

function errorHandler(err, req, res, next) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
        console.error('Error:', err);
    } else {
        // Sanitize message to remove potential file paths
        const sanitizeMessage = (msg) => {
            if (!msg) return 'Unknown error';
            // Remove potential file paths (simplified regex for common path structures)
            const sanitized = msg.replace(/(\/[a-zA-Z0-9_\-\.]+)+/g, '[PATH]');
            // Limit length
            return sanitized.substring(0, 200);
        };

        console.error('Error occurred:', {
            message: sanitizeMessage(err.message),
            status: err.status || err.statusCode || 500,
            timestamp: new Date().toISOString(),
            errorId: crypto.randomUUID()
        });
    }

    // Gemini APIエラーの処理
    if (err.message && err.message.includes('Gemini API error')) {
        const statusMatch = err.message.match(/(\d{3})/);
        const status = statusMatch ? parseInt(statusMatch[1]) : 500;

        if (status === 429) {
            return res.status(429).json({
                error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。'
            });
        } else if (status === 401 || status === 403) {
            return res.status(500).json({
                error: 'サーバーの設定エラーです。管理者に連絡してください。'
            });
        }
    }

    // body-parserなどのステータスコード付きエラーの処理
    if (err.status || err.statusCode) {
        return res.status(err.status || err.statusCode).json({
            error: err.message || 'リクエストエラーが発生しました。'
        });
    }

    // デフォルトエラー
    res.status(500).json({
        error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
    });
}

module.exports = errorHandler;
