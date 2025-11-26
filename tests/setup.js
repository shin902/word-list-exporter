/**
 * Jest setup file
 * This file is run before each test file
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock localStorage for testing
const localStorageMock = (() => {
    let store = {};

    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => {
            store[key] = value.toString();
        },
        removeItem: (key) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index) => {
            const keys = Object.keys(store);
            return keys[index] || null;
        }
    };
})();

global.localStorage = localStorageMock;

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

// Mock DOM elements to prevent errors during app.js execution
// This must be done BEFORE require('../public/app.js') because app.js runs some top-level code that accesses the DOM
const mockElement = {
    addEventListener: () => {},
    removeEventListener: () => {},
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {}
    },
    // Add methods used in app.js
    focus: () => {},
    appendChild: () => {}
};

// Also need to mock document.createElement for top-level code if any (though app.js mostly uses it inside functions)
// However, JSDOM environment provides document, so we usually don't need to mock document completely.
// But we do need to mock getElementById to return our mockElement for the IDs app.js looks for at startup.

const originalGetElementById = global.document?.getElementById;
if (typeof document !== 'undefined') {
    // Mock getElementById to return a mock element for any ID
    document.getElementById = (id) => mockElement;
}

// Load functions from app.js using require
// This executes the top-level code in app.js
const app = require('../public/app.js');

// Restore original getElementById after app.js has initialized its event listeners
if (typeof document !== 'undefined' && originalGetElementById) {
    document.getElementById = originalGetElementById;
}

// Expose exported functions to global scope for tests
// Many tests likely expect these to be global
global.parseTextToCards = app.parseTextToCards;
global.loadCards = app.loadCards;
global.saveCards = app.saveCards;
global.createCard = app.createCard;
global.generateUniqueId = app.generateUniqueId;
global.deleteCard = app.deleteCard;
global.escapeHtml = app.escapeHtml;
global.escapeHtmlAttr = app.escapeHtmlAttr;
global.sanitizeInput = app.sanitizeInput;
global.parseSubscriptSuperscript = app.parseSubscriptSuperscript;
global.debounce = app.debounce;
global.performOCR = app.performOCR;
global.shuffleCards = app.shuffleCards;
global.secureRandom = app.secureRandom;
global.secureRandomInt = app.secureRandomInt;

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
