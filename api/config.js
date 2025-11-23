require('dotenv').config();

function validateConfig() {
    // テスト環境の場合は検証をスキップし、ダミーキーを設定
    if (process.env.NODE_ENV === 'test') {
        if (!process.env.GEMINI_API_KEY) {
            process.env.GEMINI_API_KEY = 'test-key';
        }
        return;
    }

    const required = ['GEMINI_API_KEY'];

    if (process.env.NODE_ENV === 'production') {
        required.push('FRONTEND_URL');

        // Redis設定の確認 (KV_URL または REDIS_URL のいずれかが必要)
        if (!process.env.KV_URL && !process.env.REDIS_URL) {
            throw new Error('本番環境ではRedis (KV_URL または REDIS_URL) の設定が必須です。');
        }
    }

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`必須の環境変数が設定されていません: ${missing.join(', ')}`);
    }
}

validateConfig();

module.exports = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
};
