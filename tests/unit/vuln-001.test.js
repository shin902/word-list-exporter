// tests/vuln-001.test.js

// JSDOM環境のセットアップ
require('../setup');

describe('vulnerability: Prototype Pollution (vuln-001)', () => {
    let app;

    beforeEach(() => {
        // 各テストの前にlocalStorageをクリア
        localStorage.clear();
        // `polluted`プロパティがクリーンな状態であることを確認
        expect({}.polluted).toBeUndefined();
        // appモジュールを動的にインポート
        jest.isolateModules(() => {
            app = require('../../public/app.js');
        });
    });

    afterEach(() => {
        // テスト後に汚染されたプロパティをクリーンアップ
        delete Object.prototype.polluted;
    });

    test('should NOT pollute Object.prototype when loading cards with __proto__', () => {
        // 悪意のあるペイロード
        const maliciousPayload = JSON.stringify([
            {
                "__proto__": {
                    "polluted": true
                },
                "question": "test",
                "answer": "test"
            }
        ]);

        // localStorageに悪意のあるデータをセット
        localStorage.setItem('MEMORY', maliciousPayload);

        // loadCards関数を実行
        const cards = app.loadCards();

        // Object.prototypeが汚染されていないことを確認
        expect({}.polluted).toBeUndefined();
    });

    test('should create a safe card object without polluted properties', () => {
        // 悪意のあるペイロード
        const maliciousPayload = JSON.stringify([
            {
                "__proto__": {
                    "polluted": true
                },
                "question": "test",
                "answer": "test"
            }
        ]);

        // localStorageに悪意のあるデータをセット
        localStorage.setItem('MEMORY', maliciousPayload);

        // loadCards関数を実行
        const cards = app.loadCards();

        // カードオブジェクトに`polluted`プロパティが存在しないことを確認
        expect(cards[0].polluted).toBeUndefined();

        // 期待されるプロパティが存在することを確認
        expect(cards[0]).toHaveProperty('question', 'test');
        expect(cards[0]).toHaveProperty('answer', 'test');
    });

    test('should correctly handle multiple malicious properties', () => {
        const maliciousPayload = JSON.stringify([
            {
                "__proto__": { "polluted": true },
                "constructor": { "prototype": { "polluted": true } },
                "question": "another test",
                "answer": "another answer"
            }
        ]);

        localStorage.setItem('MEMORY', maliciousPayload);
        const cards = app.loadCards();

        expect({}.polluted).toBeUndefined();
        expect(cards[0].polluted).toBeUndefined();
        expect(cards[0]).toHaveProperty('question', 'another test');
    });

    test('should handle arrays with null or non-object values gracefully', () => {
        const mixedPayload = JSON.stringify([
            null,
            { "question": "q1", "answer": "a1" },
            "not_an_object",
            undefined,
            { "__proto__": { "polluted": true }, "question": "q2", "answer": "a2" }
        ]);

        localStorage.setItem('MEMORY', mixedPayload);
        const cards = app.loadCards();

        expect({}.polluted).toBeUndefined();
        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('q1');
        expect(cards[1].question).toBe('q2');
        expect(cards[1].polluted).toBeUndefined();
    });

    test('should handle malicious category objects and assign a default category', () => {
        const maliciousPayload = JSON.stringify([
            {
                "question": "test",
                "answer": "test",
                "category": { "__proto__": { "polluted": true } }
            }
        ]);

        localStorage.setItem('MEMORY', maliciousPayload);
        const cards = app.loadCards();

        expect({}.polluted).toBeUndefined();
        expect(cards.length).toBe(1);
        expect(typeof cards[0].category).toBe('string');
        expect(cards[0].category).toBe('未分類');
    });

    test('should still migrate legacy cards without an ID', () => {
        const legacyPayload = JSON.stringify([
            {
                "question": "legacy question",
                "answer": "legacy answer",
                "category": "legacy"
            }
        ]);

        localStorage.setItem('MEMORY', legacyPayload);
        const cards = app.loadCards();

        expect(cards.length).toBe(1);
        expect(cards[0].question).toBe('legacy question');
        expect(cards[0].id).toBeDefined();
        expect(typeof cards[0].id).toBe('string');
    });
});
