const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
require('./config');

const ocrRouter = require('./routes/ocr');
const errorHandler = require('./middleware/errorHandler');
const { sanitizeClientIp } = require('./utils/network');

const app = express();

// セキュリティ - 情報漏洩を防ぐため厳格な設定
app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true, // X-Powered-By ヘッダーを削除
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: true,
    xssFilter: true
}));

// 追加でX-Powered-Byを確実に削除
app.disable('x-powered-by');

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

// ボディパーサー（Base64エンコード後1MB + JSONメタデータを考慮）
app.use(express.json({ limit: '1.5mb' }));

// body-parserによってスローされるエラーを専門に処理するミドルウェア。
// express.json()の直後、かつルートハンドラの前に配置する必要があります。
app.use((err, req, res, next) => {
    const clientIp = sanitizeClientIp(req.ip);
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error(`Invalid JSON in request body from IP: ${clientIp}`, { error: err.message });
        return res.status(400).json({ error: 'リクエストのJSON形式が正しくありません。' });
    }
    if (err && err.type === 'entity.too.large') {
        console.error(`Request entity too large from IP: ${clientIp}`, { size: req.headers['content-length'] });
        return res.status(413).json({ error: 'リクエストのペイロードが大きすぎます。' });
    }
    next(err);
});

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
