const {
    secureRandom,
    secureRandomInt,
    shuffleCards
} = require('../../public/app');

describe('secureRandom', () => {
    test('returns number between 0 and 1', () => {
        for (let i = 0; i < 100; i++) {
            const result = secureRandom();
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(1);
        }
    });

    test('produces different values', () => {
        const values = new Set();
        for (let i = 0; i < 100; i++) {
            values.add(secureRandom());
        }
        expect(values.size).toBeGreaterThan(90); // High entropy expected
    });

    test('throws error when crypto is unavailable', () => {
        // Save original crypto
        const originalCrypto = global.crypto;
        const originalGetRandomValues = global.crypto?.getRandomValues;

        // Temporarily remove crypto
        delete global.crypto;

        expect(() => secureRandom()).toThrow('このブラウザでは安全な乱数生成がサポートされていません。');

        // Restore crypto
        global.crypto = originalCrypto;
        if (originalGetRandomValues && global.crypto) {
            global.crypto.getRandomValues = originalGetRandomValues;
        }
    });
});

describe('secureRandomInt', () => {
    test('returns integers within range', () => {
        for (let i = 0; i < 100; i++) {
            const result = secureRandomInt(10);
            expect(Number.isInteger(result)).toBe(true);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(10);
        }
    });

    test('handles different max values', () => {
        const testCases = [5, 10, 50, 100];
        testCases.forEach(max => {
            for (let i = 0; i < 50; i++) {
                const result = secureRandomInt(max);
                expect(Number.isInteger(result)).toBe(true);
                expect(result).toBeGreaterThanOrEqual(0);
                expect(result).toBeLessThan(max);
            }
        });
    });

    test('throws error when crypto is unavailable', () => {
        // Save original crypto
        const originalCrypto = global.crypto;
        const originalGetRandomValues = global.crypto?.getRandomValues;

        // Temporarily remove crypto
        delete global.crypto;

        expect(() => secureRandomInt(10)).toThrow('このブラウザでは安全な乱数生成がサポートされていません。');

        // Restore crypto
        global.crypto = originalCrypto;
        if (originalGetRandomValues && global.crypto) {
            global.crypto.getRandomValues = originalGetRandomValues;
        }
    });
});

describe('shuffleCards', () => {
    test('shuffles array without losing elements', () => {
        const cards = [
            { category: 'A', question: '1', answer: '1' },
            { category: 'B', question: '2', answer: '2' },
            { category: 'C', question: '3', answer: '3' }
        ];
        const shuffled = shuffleCards(cards);

        expect(shuffled.length).toBe(cards.length);
        expect(shuffled).toContainEqual(cards[0]);
        expect(shuffled).toContainEqual(cards[1]);
        expect(shuffled).toContainEqual(cards[2]);
    });

    test('does not modify original array', () => {
        const cards = [{ category: 'A', question: '1', answer: '1' }];
        const original = [...cards];
        shuffleCards(cards);
        expect(cards).toEqual(original);
    });

    test('produces different shuffle results', () => {
        const cards = Array.from({ length: 10 }, (_, i) => ({
            category: 'Test',
            question: `Q${i}`,
            answer: `A${i}`
        }));

        // Shuffle multiple times and check if we get different results
        const shuffles = new Set();
        for (let i = 0; i < 10; i++) {
            const shuffled = shuffleCards(cards);
            const serialized = JSON.stringify(shuffled.map(c => c.question));
            shuffles.add(serialized);
        }

        // We should get at least 8 different shuffle results out of 10 attempts
        // (statistically very likely with 10 elements)
        expect(shuffles.size).toBeGreaterThan(7);
    });

    test('handles empty array', () => {
        const cards = [];
        const shuffled = shuffleCards(cards);
        expect(shuffled).toEqual([]);
    });

    test('handles single element array', () => {
        const cards = [{ category: 'A', question: '1', answer: '1' }];
        const shuffled = shuffleCards(cards);
        expect(shuffled).toEqual(cards);
    });
});
