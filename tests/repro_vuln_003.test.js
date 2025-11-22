const { generateUniqueId } = require('../public/app.js');

describe('vuln-003: Weak Random ID Generation', () => {
    let originalCrypto;

    beforeEach(() => {
        // Save the original crypto
        originalCrypto = global.crypto;
    });

    afterEach(() => {
        // Restore the original crypto
        Object.defineProperty(global, 'crypto', {
            value: originalCrypto,
            writable: true
        });
    });

    test('throws error when crypto is undefined', () => {
        // Force crypto to be undefined
        Object.defineProperty(global, 'crypto', {
            value: undefined,
            writable: true
        });

        expect(() => generateUniqueId()).toThrow('このブラウザでは安全な乱数生成がサポートされていません。');
    });

    test('uses secure generation (randomUUID) when available', () => {
        // Explicitly mock crypto with randomUUID to ensure consistent behavior
        const mockRandomUUID = jest.fn(() => '12345678-1234-4abc-8def-1234567890ab');

        Object.defineProperty(global, 'crypto', {
            value: {
                randomUUID: mockRandomUUID,
                // getRandomValues might or might not be present, randomUUID takes precedence
                getRandomValues: jest.fn()
            },
            writable: true
        });

        const id = generateUniqueId();

        expect(mockRandomUUID).toHaveBeenCalled();
        expect(id).toBe('12345678-1234-4abc-8def-1234567890ab');
    });

    test('uses getRandomValues when randomUUID is unavailable', () => {
        // Mock crypto with only getRandomValues
        Object.defineProperty(global, 'crypto', {
            value: {
                randomUUID: undefined,
                getRandomValues: (array) => {
                    for (let i = 0; i < array.length; i++) {
                        // Fill with known values for predictability if needed,
                        // or just random numbers. Let's use random.
                        array[i] = Math.floor(Math.random() * 0xFFFFFFFF);
                    }
                    return array;
                }
            },
            writable: true
        });

        const id = generateUniqueId();

        // The fallback format is 4 parts of base36 strings joined by hyphen
        const randomValuesRegex = /^[0-9a-z]+-[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/i;

        expect(randomValuesRegex.test(id)).toBeTruthy();
    });
});
