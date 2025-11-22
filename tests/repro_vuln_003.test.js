
const { generateUniqueId } = require('../public/app.js');

describe('vuln-003: Weak Random ID Generation', () => {
    let originalCrypto;

    beforeEach(() => {
        // Save the original crypto
        originalCrypto = global.crypto;
    });

    afterEach(() => {
        // Restore the original crypto
        if (originalCrypto) {
            Object.defineProperty(global, 'crypto', {
                value: originalCrypto,
                writable: true
            });
        } else {
            // If it was undefined originally (though unlikely in jsdom)
            delete global.crypto;
        }
    });

    test('throws error when crypto is undefined', () => {
        // Force crypto to be undefined
        Object.defineProperty(global, 'crypto', {
            value: undefined,
            writable: true
        });

        expect(() => generateUniqueId()).toThrow('Secure random number generation is not supported by this browser.');
    });

    test('uses secure generation when available', () => {
        // This test runs with the default environment (which has crypto mocked in setup.js or jsdom)

        const id = generateUniqueId();

        // Check if it is a valid ID (either UUID or the 4-part randomValues format)
        // UUID: 8-4-4-4-12 hex chars
        // getRandomValues: 4 parts of base36 strings joined by hyphen

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const randomValuesRegex = /^[0-9a-z]+-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/i;

        const isUuid = uuidRegex.test(id);
        const isRandomValues = randomValuesRegex.test(id);

        expect(isUuid || isRandomValues).toBeTruthy();
    });
});
