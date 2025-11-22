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

// Mock crypto.randomUUID if not available
if (typeof crypto === 'undefined' || !crypto.randomUUID) {
    global.crypto = {
        randomUUID: () => {
            // Fallback implementation for testing
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    };
}

// Load app.js functions for testing
// In a real setup, you would extract functions to modules and import them
// For now, we'll define essential functions directly in the test setup

// Define escapeHtmlAttr for testing
global.escapeHtmlAttr = function(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Define sanitizeInput for testing (updated version with Unicode control chars)
global.sanitizeInput = function(text, maxLength = 1000) {
    if (!text) return '';
    return text.replace(/[\x00-\x1F\x7F-\x9F\u2028\u2029]/g, '')
               .trim()
               .substring(0, maxLength);
};

// Define escapeHtml for testing
global.escapeHtml = function(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// Define parseSubscriptSuperscript for testing (with ReDoS prevention)
global.parseSubscriptSuperscript = function(text) {
    text = global.escapeHtml(text);
    text = text.replace(/\^\{([^}]{1,100})\}/g, '<span class="superscript">$1</span>');
    text = text.replace(/\^(.)/g, '<span class="superscript">$1</span>');
    text = text.replace(/\_\{([^}]{1,100})\}/g, '<span class="subscript">$1</span>');
    text = text.replace(/\_(.)/g, '<span class="subscript">$1</span>');
    return text;
};

// Load other functions from app.js
const fs = require('fs');
const path = require('path');

// Read app.js and extract only function definitions (avoid executing event listeners)
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Mock DOM elements to prevent errors during app.js execution
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
    }
};

const originalGetElementById = global.document?.getElementById;
if (typeof document !== 'undefined') {
    // Mock getElementById to return a mock element for any ID
    document.getElementById = (id) => mockElement;

    try {
        // Execute app.js in global scope to make functions available
        eval(appJsContent);
    } catch (error) {
        // Ignore errors from event listener setup
        if (!error.message.includes('addEventListener')) {
            console.error('Error loading app.js:', error);
        }
    }

    // Restore original getElementById
    if (originalGetElementById) {
        document.getElementById = originalGetElementById;
    }
}
