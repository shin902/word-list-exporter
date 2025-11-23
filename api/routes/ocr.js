const express = require('express');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const { performOCR } = require('../utils/gemini');

const router = express.Router();

// Redisクライアントの初期化（環境変数が設定されている場合）
const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
let store;

if (process.env.NODE_ENV === 'production' && !redisUrl) {
    throw new Error('FATAL: Redis (KV_URL or REDIS_URL) must be configured in production for rate limiting to work correctly in serverless environment.');
}

if (redisUrl) {
    const client = new Redis(redisUrl);
    store = new RedisStore({
        sendCommand: (...args) => client.call(...args),
    });
} else {
    console.warn('WARNING: Redis is not configured. Rate limiting will be ineffective in serverless environments.');
}

// レート制限の設定
// Redisが設定されている場合は外部ストアを使用し、標準的な制限（100リクエスト/時間）を適用
// Redisが設定されていない場合（特にProduction環境）、Serverless環境でのバイパスを防ぐため
// 極端に厳しい制限（1リクエスト/時間/インスタンス）を適用するか、管理者への警告とする。
const limitMax = store ? 100 : (process.env.NODE_ENV === 'production' ? 1 : 100);
const limitMessage = store
    ? 'レート制限に達しました。1時間後に再試行してください。'
    : 'Security Warning: Redis is not configured. Rate limit exceeded for this instance.';

const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: limitMax,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: limitMessage }
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

        // Base64データサイズの制限（例: 5MB）
        const MAX_BASE64_SIZE = 5 * 1024 * 1024;
        if (base64Data.length > MAX_BASE64_SIZE) {
            return res.status(413).json({ error: '画像データが大きすぎます' });
        }

        // Base64形式の検証 (RFC 4648に従い、ホワイトスペースを除去してから検証)
        // 正規表現による検証は大きなデータに対してDoSの可能性があるため、
        // 簡易的な文字チェックのみ行うか、デコード時のエラーハンドリングに任せる
        const cleanedBase64Data = base64Data.replace(/\s/g, '');

        // 簡易チェック: Base64文字以外が含まれていないか
        // Note: 完全なBase64検証は高コストなため、ここでは明らかに不正な文字のみチェックするか、
        // Buffer.fromでのデコード結果を信頼する。
        // ここでは、正規表現による全文スキャンを避けるため、チェックを省略し
        // performOCR内での処理に任せるか、必要ならより軽量なチェックを実装する。
        // しかし、gemini apiに送る前に最低限のチェックはしておきたい。
        // Node.jsのBufferは非Base64文字を無視する仕様があるため、
        // 厳密なチェックが必要ならバリデーターライブラリを使うべきだが、
        // ここではReDoS回避のため正規表現チェックを削除する。

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
