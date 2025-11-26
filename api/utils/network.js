/**
 * clientIPのサニタイズ（ログインジェクション対策）
 * @param {string} ip - サニタイズするIPアドレス
 * @returns {string} - サニタイズされたIPアドレス
 */
function sanitizeClientIp(ip) {
    if (!ip || typeof ip !== 'string') return 'unknown';
    // 改行文字とキャリッジリターンを除去
    return ip.replace(/[\r\n]/g, '').substring(0, 45); // IPv6最大長 + 余裕
}

/**
 * ExpressリクエストオブジェクトからクライアントIPアドレスを取得する
 * app.set('trust proxy', 1)が設定されていることを前提とする
 * @param {import('express').Request} req - Expressリクエストオブジェクト
 * @returns {string} - クライアントIPアドレス
 */
function getClientIp(req) {
    // 'trust proxy'が有効なため、req.ipは信頼できるIPを返す
    return (req && req.ip && req.ip.trim()) || 'unknown';
}

module.exports = {
    sanitizeClientIp,
    getClientIp
};
