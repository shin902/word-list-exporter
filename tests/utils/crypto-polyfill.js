// tests/utils/crypto-polyfill.js
const crypto = require('crypto');
if (typeof global.crypto !== 'object') {
    global.crypto = {};
}
if (typeof global.crypto.randomUUID !== 'function') {
    global.crypto.randomUUID = crypto.randomUUID;
}
