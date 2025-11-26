// tests/setup-node.js

// Polyfill crypto for Node.js environment
// This is necessary because while the `crypto` module is available,
// its methods are not on the global scope by default in Jest's Node environment.
const crypto = require('crypto');
if (typeof global.crypto !== 'object') {
    global.crypto = {};
}
if (typeof global.crypto.randomUUID !== 'function') {
    global.crypto.randomUUID = crypto.randomUUID;
}

// Cleanup OCR timer after all tests to prevent "worker has failed to exit gracefully" warning
afterAll(() => {
    try {
        const { clearTimer } = require('../api/routes/ocr');
        if (typeof clearTimer === 'function') {
            clearTimer();
        }
    } catch (e) {
        // Ignore if OCR module is not loaded
    }
});
