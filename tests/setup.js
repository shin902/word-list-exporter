/**
 * Jest setup file for jsdom environment
 */

require('./utils/crypto-polyfill');
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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
