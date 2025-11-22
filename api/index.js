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
app.use(cors({
    origin: process.env.FRONTEND_URL || false,
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
