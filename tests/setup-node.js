/**
 * Jest setup file for Node.js environment
 */

require('./utils/crypto-polyfill');

// Suppress console output during tests (test assertions are preserved)
// テスト中のconsole出力を抑制（テストアサーションは維持）
// Use jest.spyOn() to maintain compatibility with existing test spies
// To enable console output for debugging, run: DEBUG=1 npm test
beforeEach(() => {
    if (!process.env.DEBUG) {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'info').mockImplementation(() => {});
        jest.spyOn(console, 'debug').mockImplementation(() => {});
    }
});

afterEach(() => {
    jest.restoreAllMocks();
});

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
