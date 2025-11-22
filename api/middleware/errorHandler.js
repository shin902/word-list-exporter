function errorHandler(err, req, res, next) {
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    } else {
        console.error('Error occurred:', {
            message: err.message,
            status: err.status || err.statusCode || 500,
            timestamp: new Date().toISOString()
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
