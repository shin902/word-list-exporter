const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');
const LRUCache = require('lru-cache');
const { performOCR } = require('../utils/gemini');
const { getClientIp, sanitizeClientIp } = require('../utils/network');

const router = express.Router();

// 10,000エントリ上限（15分ウィンドウで約11 req/sec の新規IPレートに対応）
// 想定メモリ使用量: ~1MB (10,000 entries * ~100 bytes/entry)
const MAX_COUNTER_ENTRIES = 10000;

// 不正リクエスト検出用カウンター（DoS攻撃の検出）
const failedValidationCounter = new LRUCache({ max: MAX_COUNTER_ENTRIES });
const FAILED_VALIDATION_THRESHOLD = 10; // 10回の失敗でアラート
const COUNTER_RESET_INTERVAL = 15 * 60 * 1000; // 15分でリセット


// タイマー管理
let counterResetTimer = null;

/**
 * カウンターリセットタイマーを初期化
 * テスト環境でプロセスが正常に終了できるようにunref()を使用
 */
function initializeTimer() {
    if (counterResetTimer) return;
    counterResetTimer = setInterval(() => {
        failedValidationCounter.clear();
    }, COUNTER_RESET_INTERVAL);
    // Node.js環境でのみunref()を呼び出す（jsdom環境では利用不可）
    try {
        if (typeof counterResetTimer.unref === 'function') {
            counterResetTimer.unref();
        }
    } catch (e) {
        // Ignore unref errors in non-Node environments
    }
}

/**
 * カウンターリセットタイマーをクリア
 * テストのクリーンアップ用
 */
function clearTimer() {
    if (counterResetTimer) {
        clearInterval(counterResetTimer);
        counterResetTimer = null;
    }
}

/**
 * Redis クライアントを切断
 * テストのクリーンアップ用
 */
async function closeRedisClient() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

// タイマーを初期化
initializeTimer();

// Redisクライアントの初期化（環境変数が設定されている場合）
const redisUrl = process.env.KV_URL || process.env.REDIS_URL;
let store;
let redisClient = null;

// Jest テスト環境を検出（NODE_ENV が 'test' でなくても Jest で実行されている場合を考慮）
const isJestEnvironment = typeof jest !== 'undefined' || process.env.JEST_WORKER_ID !== undefined;

if (process.env.NODE_ENV === 'production' && !redisUrl && !isJestEnvironment) {
    throw new Error('FATAL: Redis (KV_URL or REDIS_URL) must be configured in production for rate limiting to work correctly in serverless environment.');
}

// テスト環境では Redis クライアントを作成しない（ハンドルリーク防止）
if (redisUrl && !isJestEnvironment) {
    redisClient = new Redis(redisUrl);
    store = new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    });
} else if (!redisUrl && !isJestEnvironment) {
    console.warn('WARNING: Redis is not configured. Rate limiting will be ineffective in serverless environments.');
}

// レート制限の設定
// Redisが設定されている場合は外部ストアを使用し、標準的な制限を適用
// OCRエンドポイントはより厳格な制限（20リクエスト/時間）を適用
const strictLimitMax = store ? 20 : (process.env.NODE_ENV === 'production' ? 1 : 20);
const generalLimitMax = store ? 100 : (process.env.NODE_ENV === 'production' ? 1 : 100);

const strictLimitMessage = store
    ? 'レート制限に達しました。1時間後に再試行してください。'
    : 'Security Warning: Redis is not configured. Rate limit exceeded for this instance.';

// OCRエンドポイント用の厳格なレート制限
const strictLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1時間
    max: strictLimitMax, // OCRエンドポイントはより厳しく制限
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: strictLimitMessage },
    skipSuccessfulRequests: false, // すべてのリクエストをカウント
    // デフォルトのキー生成器を使用（IPv6対応済み）
    // Vercel等のプロキシ環境ではX-Forwarded-Forが自動的に使用される
    validate: { xForwardedForHeader: false } // プロキシ環境での警告を抑制
});

// 一般的なレート制限（他のエンドポイント用）
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: generalLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    store: store,
    message: { error: strictLimitMessage }
});

/**
 * サンプリングベースのBase64バリデーション（ReDoS回避）
 * 大きなデータに対して効率的に検証を行う
 * @param {string} str - 検証するBase64文字列
 * @returns {boolean} - 有効な場合true
 */
function isValidBase64Sample(str) {
    if (!str || typeof str !== 'string' || str.length === 0) {
        return false;
    }

    // サンプリングベースの検証（ReDoS回避）
    // 先頭、中間、末尾の各100文字をサンプリングして検証
    const sampleSize = 100;
    const samples = [];
    
    // 先頭部分
    samples.push(str.substring(0, Math.min(sampleSize, str.length)));
    
    // 中間部分（文字列が十分長い場合）
    if (str.length > sampleSize * 2) {
        const midStart = Math.floor(str.length / 2) - Math.floor(sampleSize / 2);
        samples.push(str.substring(midStart, midStart + sampleSize));
    }
    
    // 末尾部分（文字列が十分長い場合）
    if (str.length > sampleSize) {
        samples.push(str.substring(str.length - sampleSize));
    }

    const base64Regex = /^[A-Za-z0-9+/=]*$/;
    return samples.every(sample => base64Regex.test(sample));
}

/**
 * 不正リクエストをカウントし、閾値を超えた場合にログ出力
 * @param {string} ip - リクエスト元のIPアドレス
 */
function trackFailedValidation(ip) {
    const count = (failedValidationCounter.get(ip) || 0) + 1;
    failedValidationCounter.set(ip, count);
    
    if (count === FAILED_VALIDATION_THRESHOLD) {
        console.warn(`[SECURITY] Possible DoS attack detected from IP: ${ip}. Failed validations: ${count}`);
    }
}

/**
 * バリデーションエラーを送信するヘルパー関数
 * errorIdを含めることで、クライアントエラーとサーバーログの相関を可能にする
 * trackFailedValidationを統合してログ重複を防止
 * @param {object} res - Expressレスポンスオブジェクト
 * @param {number} status - HTTPステータスコード
 * @param {string} message - エラーメッセージ
 * @param {string} clientIp - クライアントIPアドレス
 * @returns {Object} Expressレスポンスオブジェクト（ルートハンドラでの早期リターン用）
 */
function sendValidationError(res, status, message, clientIp) {
    const errorId = crypto.randomUUID();
    const sanitizedIp = sanitizeClientIp(clientIp);
    // trackFailedValidation を統合（ログ重複を防止）
    trackFailedValidation(sanitizedIp);
    return res.status(status).json({
        error: message,
        errorId: errorId
    });
}

router.post('/', strictLimiter, async (req, res, next) => {
    const clientIp = getClientIp(req);
    
    try {
        const { image } = req.body;

        // バリデーション
        if (!image) {
            return sendValidationError(res, 400, '画像データが必要です', clientIp);
        }

        if (typeof image !== 'string' || !image.startsWith('data:image/')) {
            return sendValidationError(res, 400, '無効な画像形式です', clientIp);
        }

        // Base64データの抽出
        const base64Data = image.split(',')[1];
        if (!base64Data) {
            return sendValidationError(res, 400, '画像データの解析に失敗しました', clientIp);
        }

        // Base64データサイズの制限（1MB - クライアント側で圧縮済みの画像を想定）
        const MAX_BASE64_SIZE = 1 * 1024 * 1024;
        if (base64Data.length > MAX_BASE64_SIZE) {
            return sendValidationError(res, 413, '画像データが大きすぎます', clientIp);
        }

        // Base64形式の検証 (RFC 4648に従い、ホワイトスペースを除去してから検証)
        const cleanedBase64Data = base64Data.replace(/\s/g, '');

        // ホワイトスペース除去後のデータが空でないか確認
        if (cleanedBase64Data.length === 0) {
            return sendValidationError(res, 400, '画像データの解析に失敗しました', clientIp);
        }

        // サンプリングベースのBase64バリデーション（ReDoS回避）
        // 大きなデータに対して効率的に検証を行う
        if (!isValidBase64Sample(cleanedBase64Data)) {
            return sendValidationError(res, 400, '無効なBase64形式です', clientIp);
        }

        // 追加検証: パディングの整合性チェック
        const paddingMatch = cleanedBase64Data.match(/=+$/);
        if (paddingMatch) {
            const paddingLength = paddingMatch[0].length;
            // パディングは最大2文字まで
            if (paddingLength > 2) {
                return sendValidationError(res, 400, '無効なBase64形式です', clientIp);
            }
            // パディングを除いた長さが4の倍数になるか確認
            const dataWithoutPadding = cleanedBase64Data.length - paddingLength;
            if ((dataWithoutPadding + paddingLength) % 4 !== 0) {
                return sendValidationError(res, 400, '無効なBase64形式です', clientIp);
            }
        }

        // Base64デコード検証
        try {
            const decodedData = Buffer.from(cleanedBase64Data, 'base64');
            // Buffer.fromは無効な文字を無視するため、デコード後のデータが空でないか、
            // 元のデータが非ASCII文字のみで構成されていないかも確認する
            if (decodedData.length === 0 && cleanedBase64Data.length > 0) {
                 // 空の文字列が有効なケースもあるため、追加のチェックを行う
                const nonAsciiRegex = /[^\x00-\x7F]/;
                if (!nonAsciiRegex.test(cleanedBase64Data)) {
                    throw new Error('Invalid Base64 string resulted in empty buffer');
                }
            }
        } catch (e) {
            return sendValidationError(res, 400, '無効なBase64形式です (デコード失敗)', clientIp);
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
module.exports.clearTimer = clearTimer;
module.exports.closeRedisClient = closeRedisClient;

// Export for testing purposes only
if (process.env.NODE_ENV === 'test') {
    module.exports.sendValidationError = sendValidationError;
}
module.exports.trackFailedValidation = trackFailedValidation;
module.exports.failedValidationCounter = failedValidationCounter;
module.exports.MAX_COUNTER_ENTRIES = MAX_COUNTER_ENTRIES;
module.exports.FAILED_VALIDATION_THRESHOLD = FAILED_VALIDATION_THRESHOLD;
