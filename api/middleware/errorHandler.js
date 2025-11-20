function errorHandler(err, req, res, next) {
    console.error('Error:', err);

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

    // デフォルトエラー
    res.status(500).json({
        error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
    });
}

module.exports = errorHandler;
