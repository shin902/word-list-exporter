/**
 * Jest setup file for jsdom environment
 */

require('./utils/crypto-polyfill');
const { TextEncoder, TextDecoder } = require('util');

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

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock localStorage for testing
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value.toString(); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (index) => {
            const keys = Object.keys(store);
            return keys[index] || null;
        }
    };
})();

global.localStorage = localStorageMock;

// Mock DOM elements required by app.js at the top-level
const mockElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    focus: () => {},
    appendChild: () => {}
};

if (typeof document !== 'undefined') {
    document.getElementById = (id) => mockElement;
}

// Load functions from app.js and expose them to the global scope for tests
const app = require('../public/app.js');
Object.assign(global, app);
