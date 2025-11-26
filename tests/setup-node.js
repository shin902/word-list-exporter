/**
 * Jest setup file for Node.js environment
 */

require('./utils/crypto-polyfill');

// Cleanup OCR resources after all tests to prevent "worker has failed to exit gracefully" warning
afterAll(() => {
    try {
        const { cleanup } = require('../api/routes/ocr');
        if (typeof cleanup === 'function') {
            cleanup();
        }
    } catch (e) {
        // Ignore if OCR module is not loaded
    }
});
