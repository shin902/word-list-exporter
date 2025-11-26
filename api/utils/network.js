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

module.exports = {
    sanitizeClientIp
};
