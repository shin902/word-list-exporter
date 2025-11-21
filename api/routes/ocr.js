const express = require('express');
const rateLimit = require('express-rate-limit');
const { performOCR } = require('../utils/gemini');

const router = express.Router();

// レート制限: 1時間あたり100リクエスト
// 注意: VercelなどのServerless環境ではメモリ上のストアはリクエスト毎にリセットされる可能性があるため、
// 厳密な制限にはRedisなどの外部ストアが必要です。今回は簡易的な実装とします。
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
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

        // Base64形式の検証
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
            return res.status(400).json({ error: '無効なBase64データです' });
        }

        // OCR実行
        const result = await performOCR(base64Data);

        res.json({
            success: true,
            text: result
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
