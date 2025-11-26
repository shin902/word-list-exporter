/**
 * Jest setup file for Node.js environment
 */

require('./utils/crypto-polyfill');

// Mock console methods to suppress output during tests
// but still allow tests to verify console method calls
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// Clear console mock calls before each test
beforeEach(() => {
    jest.clearAllMocks();
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
