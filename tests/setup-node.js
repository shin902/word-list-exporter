/**
 * Jest setup file for Node.js environment
 */

require('./utils/crypto-polyfill');

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
