const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const ocrRouter = require('./routes/ocr');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// セキュリティ
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['POST'],
    allowedHeaders: ['Content-Type']
}));

// ボディパーサー（画像サイズを考慮）
app.use(express.json({ limit: '10mb' }));

// 静的ファイルの配信（ローカル開発用）
app.use(express.static(__dirname + '/../'));

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
