/**
 * Unit tests for text parsing functions
 * Run these tests using a test framework like Jest or Mocha
 */

describe('parseTextToCards', () => {
    // Mock DOM elements needed by parseTextToCards
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="import-category-input" value="テストカテゴリ" />
        `;
    });

    test('parses arrow-separated format', () => {
        const text = 'apple→りんご\nbanana→バナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
        expect(cards[1].question).toBe('banana');
        expect(cards[1].answer).toBe('バナナ');
    });

    test('parses colon-separated format', () => {
        const text = 'apple:りんご\nbanana:バナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
    });

    test('parses hyphen-separated format', () => {
        const text = 'apple-りんご\nbanana-バナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
    });

    test('parses space-separated format', () => {
        const text = 'apple りんご\nbanana バナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
    });

    test('parses tab-separated format', () => {
        const text = 'apple\tりんご\nbanana\tバナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
    });

    test('parses consecutive line pairs', () => {
        const text = 'apple\nりんご\nbanana\nバナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
        expect(cards[0].question).toBe('apple');
        expect(cards[0].answer).toBe('りんご');
        expect(cards[1].question).toBe('banana');
        expect(cards[1].answer).toBe('バナナ');
    });

    test('assigns unique IDs to each card', () => {
        const text = 'apple→りんご\nbanana→バナナ';
        const cards = parseTextToCards(text);

        expect(cards[0].id).toBeDefined();
        expect(cards[1].id).toBeDefined();
        expect(cards[0].id).not.toBe(cards[1].id);
    });

    test('uses category from input field', () => {
        const text = 'apple→りんご';
        const cards = parseTextToCards(text);

        expect(cards[0].category).toBe('テストカテゴリ');
    });

    test('uses default category when input is empty', () => {
        document.getElementById('import-category-input').value = '';
        const text = 'apple→りんご';
        const cards = parseTextToCards(text);

        expect(cards[0].category).toBe('英単語');
    });

    test('handles empty lines', () => {
        const text = 'apple→りんご\n\n\nbanana→バナナ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(2);
    });

    test('sanitizes input text', () => {
        const text = 'apple\x00\x01→りんご';
        const cards = parseTextToCards(text);

        expect(cards[0].question).toBe('apple');
        expect(cards[0].question).not.toContain('\x00');
    });

    test('handles multi-part answers with separators', () => {
        const text = 'word→part1 part2 part3';
        const cards = parseTextToCards(text);

        expect(cards[0].answer).toBe('part1 part2 part3');
    });

    test('handles mixed formats', () => {
        const text = 'apple→りんご\nbanana バナナ\norange:オレンジ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(3);
        expect(cards[0].answer).toBe('りんご');
        expect(cards[1].answer).toBe('バナナ');
        expect(cards[2].answer).toBe('オレンジ');
    });

    test('returns empty array for empty input', () => {
        const text = '';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(0);
    });

    test('returns empty array for whitespace-only input', () => {
        const text = '   \n\n\t\t   ';
        const cards = parseTextToCards(text);

        expect(cards.length).toBe(0);
    });
});

describe('loadCards (with migration)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('migrates legacy cards without IDs', () => {
        const legacyCards = [
            { category: '英単語', question: 'apple', answer: 'りんご' },
            { category: '英単語', question: 'banana', answer: 'バナナ' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

        const cards = loadCards();

        expect(cards.length).toBe(2);
        expect(cards[0].id).toBeDefined();
        expect(cards[1].id).toBeDefined();
        expect(cards[0].id).not.toBe(cards[1].id);
    });

    test('preserves existing IDs', () => {
        const cardsWithIds = [
            { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' },
            { id: 'id-2', category: '英単語', question: 'banana', answer: 'バナナ' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(cardsWithIds));

        const cards = loadCards();

        expect(cards[0].id).toBe('id-1');
        expect(cards[1].id).toBe('id-2');
    });

    test('handles mixed legacy and new cards', () => {
        const mixedCards = [
            { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' },
            { category: '英単語', question: 'banana', answer: 'バナナ' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(mixedCards));

        const cards = loadCards();

        expect(cards[0].id).toBe('id-1');
        expect(cards[1].id).toBeDefined();
        expect(cards[1].id).not.toBe('id-1');
    });

    test('returns empty array for non-existent data', () => {
        const cards = loadCards();
        expect(cards).toEqual([]);
    });

    test('returns empty array for corrupted data', () => {
        localStorage.setItem('MEMORY', 'corrupted{invalid}json');
        const cards = loadCards();
        expect(cards).toEqual([]);
    });

    test('returns empty array for non-array data', () => {
        localStorage.setItem('MEMORY', JSON.stringify({ not: 'an array' }));
        const cards = loadCards();
        expect(cards).toEqual([]);
    });
});

describe('deleteCard', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('deletes card by ID', () => {
        const cards = [
            { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' },
            { id: 'id-2', category: '英単語', question: 'banana', answer: 'バナナ' },
            { id: 'id-3', category: '英単語', question: 'orange', answer: 'オレンジ' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(cards));

        deleteCard('id-2');

        const remainingCards = loadCards();
        expect(remainingCards.length).toBe(2);
        expect(remainingCards.find(c => c.id === 'id-2')).toBeUndefined();
        expect(remainingCards.find(c => c.id === 'id-1')).toBeDefined();
        expect(remainingCards.find(c => c.id === 'id-3')).toBeDefined();
    });

    test('deletes card by index (legacy support)', () => {
        const cards = [
            { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' },
            { id: 'id-2', category: '英単語', question: 'banana', answer: 'バナナ' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(cards));

        deleteCard(0);

        const remainingCards = loadCards();
        expect(remainingCards.length).toBe(1);
        expect(remainingCards[0].id).toBe('id-2');
    });

    test('handles non-existent ID gracefully', () => {
        const cards = [
            { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' }
        ];
        localStorage.setItem('MEMORY', JSON.stringify(cards));

        deleteCard('non-existent-id');

        const remainingCards = loadCards();
        expect(remainingCards.length).toBe(1);
    });
});
