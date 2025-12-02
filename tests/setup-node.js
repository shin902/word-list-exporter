/**
 * Jest setup file for Node.js environment
 */

require('./utils/crypto-polyfill');

// Suppress console output during tests (test assertions are preserved)
// テスト中のconsole出力を抑制（テストアサーションは維持）
// Use jest.spyOn() to maintain compatibility with existing test spies
// To enable console output for debugging, run: DEBUG=1 npm test

/**
 * Safely spy on a console method, skipping if already mocked
 * 既にモックされている場合はスキップして安全にconsoleメソッドをスパイする
 */
function safeSpyConsole(method) {
    if (!jest.isMockFunction(console[method])) {
        jest.spyOn(console, method).mockImplementation(() => {});
    }
}

beforeEach(() => {
    if (!process.env.DEBUG) {
        safeSpyConsole('log');
        safeSpyConsole('error');
        safeSpyConsole('warn');
        safeSpyConsole('info');
        safeSpyConsole('debug');
    }
});

afterEach(() => {
    jest.restoreAllMocks();
});

// Cleanup Generate timer after all tests to prevent "worker has failed to exit gracefully" warning
afterAll(() => {
    try {
        const { clearTimer } = require('../api/routes/generate');
        if (typeof clearTimer === 'function') {
            clearTimer();
        }
    } catch (e) {
        // Ignore if Generate module is not loaded
    }
});
