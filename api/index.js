const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
require('./config');

const ocrRouter = require('./routes/ocr');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// セキュリティ
app.use(helmet());

// 本番環境では config.js で FRONTEND_URL が必須検証済み
const allowedOrigin = process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:5500' : false);

// 開発環境での情報表示
if (process.env.NODE_ENV === 'development' && !process.env.FRONTEND_URL) {
    console.log('INFO: Using default CORS origin http://localhost:5500. Set FRONTEND_URL to override.');
}

// staging等の環境でFRONTEND_URLが未設定の場合の警告
// (production環境ではconfig.jsで事前にエラーになる)
if (!allowedOrigin && process.env.NODE_ENV !== 'test') {
    console.warn('WARNING: FRONTEND_URL is not set. CORS will block all requests.');
}

app.use(cors({
    origin: allowedOrigin,
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type'],
    credentials: false
}));

// ボディパーサー（画像サイズを考慮）
app.use(express.json({ limit: '5mb' }));

// 静的ファイルの配信（ローカル開発用）
app.use(express.static(path.join(__dirname, '../public')));

// ルート
app.use('/api/ocr', ocrRouter);

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// エラーハンドリング
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// ローカル開発時のみサーバーを起動
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
