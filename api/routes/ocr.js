const express = require('express');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const { performOCR } = require('../utils/gemini');

const router = express.Router();

// Redisクライアントの初期化（環境変数が設定されている場合）
const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
let store;

if (redisUrl) {
    const client = new Redis(redisUrl);
    store = new RedisStore({
        sendCommand: (...args) => client.call(...args),
    });
}

// レート制限: 1時間あたり100リクエスト
// Redisが設定されている場合は外部ストアを使用し、そうでない場合はメモリ（デフォルト）を使用
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: 'レート制限に達しました。1時間後に再試行してください。' }
});

router.post('/', limiter, async (req, res, next) => {
    try {
        const { image } = req.body;

        // バリデーション
        if (!image) {
            return res.status(400).json({ error: '画像データが必要です' });
        }

        if (typeof image !== 'string' || !image.startsWith('data:image/')) {
            return res.status(400).json({ error: '無効な画像形式です' });
        }

        // Base64データの抽出
        const base64Data = image.split(',')[1];
        if (!base64Data) {
            return res.status(400).json({ error: '画像データの解析に失敗しました' });
        }

        // Base64データサイズの制限（例: 10MB）
        const MAX_BASE64_SIZE = 10 * 1024 * 1024;
        if (base64Data.length > MAX_BASE64_SIZE) {
            return res.status(413).json({ error: '画像データが大きすぎます' });
        }

        // Base64形式の検証 (RFC 4648に従い、ホワイトスペースを除去してから検証)
        const cleanedBase64Data = base64Data.replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanedBase64Data)) {
            return res.status(400).json({ error: '無効なBase64データです' });
        }

        // OCR実行 (クリーンアップされたBase64データを使用)
        const result = await performOCR(cleanedBase64Data);

        res.json({
            success: true,
            text: result
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
