/**
 * Integration tests for data migration
 * Tests the migration of legacy cards without IDs to the new ID-based system
 */

describe('Data Migration Integration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('Legacy Card Migration', () => {
        test('migrates all legacy cards on first load', () => {
            // Setup: Create legacy cards without IDs
            const legacyCards = [
                { category: '英単語', question: 'apple', answer: 'りんご' },
                { category: '英単語', question: 'banana', answer: 'バナナ' },
                { category: '数学', question: 'π', answer: '円周率' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

            // Execute: Load cards triggers migration
            const cards = loadCards();

            // Verify: All cards now have IDs
            expect(cards.length).toBe(3);
            cards.forEach(card => {
                expect(card.id).toBeDefined();
                expect(typeof card.id).toBe('string');
                expect(card.id.length).toBeGreaterThan(0);
            });

            // Verify: Original data is preserved
            expect(cards[0].question).toBe('apple');
            expect(cards[0].answer).toBe('りんご');
            expect(cards[1].question).toBe('banana');
            expect(cards[2].category).toBe('数学');
        });

        test('generates unique IDs for each legacy card', () => {
            const legacyCards = Array.from({ length: 100 }, (_, i) => ({
                category: 'テスト',
                question: `question${i}`,
                answer: `answer${i}`
            }));
            localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

            const cards = loadCards();

            // Extract all IDs
            const ids = cards.map(c => c.id);

            // Verify all IDs are unique
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(100);
        });

        test('saves migrated cards back to localStorage', () => {
            const legacyCards = [
                { category: '英単語', question: 'apple', answer: 'りんご' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

            // First load triggers migration
            const cards = loadCards();

            // Verify: Data in localStorage now has IDs
            const stored = JSON.parse(localStorage.getItem('MEMORY'));
            expect(stored[0].id).toBe(cards[0].id);
            expect(stored[0].id).toBeDefined();
        });

        test('does not re-migrate cards that already have IDs', () => {
            const cardsWithIds = [
                { id: 'existing-id-1', category: '英単語', question: 'apple', answer: 'りんご' },
                { id: 'existing-id-2', category: '英単語', question: 'banana', answer: 'バナナ' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(cardsWithIds));

            const cards = loadCards();

            // Verify: IDs are preserved, not regenerated
            expect(cards[0].id).toBe('existing-id-1');
            expect(cards[1].id).toBe('existing-id-2');
        });

        test('handles mixed legacy and new cards', () => {
            const mixedCards = [
                { id: 'existing-1', category: '英単語', question: 'apple', answer: 'りんご' },
                { category: '英単語', question: 'banana', answer: 'バナナ' },
                { id: 'existing-2', category: '英単語', question: 'cherry', answer: 'さくらんぼ' },
                { category: '英単語', question: 'date', answer: 'デーツ' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(mixedCards));

            const cards = loadCards();

            // Verify: Existing IDs preserved, missing IDs added
            expect(cards[0].id).toBe('existing-1');
            expect(cards[1].id).toBeDefined();
            expect(cards[1].id).not.toBe('existing-1');
            expect(cards[2].id).toBe('existing-2');
            expect(cards[3].id).toBeDefined();
            expect(cards[3].id).not.toBe('existing-2');
        });

        test('handles migration error gracefully', () => {
            const legacyCards = [
                { category: '英単語', question: 'apple', answer: 'りんご' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

            // Mock localStorage.setItem to throw QuotaExceededError
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = jest.fn(() => {
                throw new DOMException('QuotaExceededError');
            });

            // Execute: Should not throw, just log error
            const cards = loadCards();

            // Verify: Cards still returned with IDs, even though save failed
            expect(cards.length).toBe(1);
            expect(cards[0].id).toBeDefined();

            // Restore
            localStorage.setItem = originalSetItem;
        });
    });

    describe('ID-Based Deletion After Migration', () => {
        test('deletes cards by ID after migration', () => {
            // Setup: Legacy cards
            const legacyCards = [
                { category: '英単語', question: 'apple', answer: 'りんご' },
                { category: '英単語', question: 'banana', answer: 'バナナ' },
                { category: '英単語', question: 'orange', answer: 'オレンジ' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(legacyCards));

            // Migrate
            const cards = loadCards();
            const idToDelete = cards[1].id;

            // Delete by ID
            deleteCard(idToDelete);

            // Verify
            const remainingCards = loadCards();
            expect(remainingCards.length).toBe(2);
            expect(remainingCards.find(c => c.id === idToDelete)).toBeUndefined();
            expect(remainingCards.map(c => c.question)).toEqual(['apple', 'orange']);
        });

        test('backward compatibility: still supports index-based deletion', () => {
            const cards = [
                { id: 'id-1', category: '英単語', question: 'apple', answer: 'りんご' },
                { id: 'id-2', category: '英単語', question: 'banana', answer: 'バナナ' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(cards));

            // Delete by index (legacy method)
            deleteCard(0);

            const remainingCards = loadCards();
            expect(remainingCards.length).toBe(1);
            expect(remainingCards[0].id).toBe('id-2');
        });
    });

    describe('Card Creation After Migration', () => {
        test('new cards get unique IDs automatically', () => {
            // Setup: Start with migrated cards
            const existingCards = [
                { id: 'existing-1', category: '英単語', question: 'apple', answer: 'りんご' }
            ];
            localStorage.setItem('MEMORY', JSON.stringify(existingCards));

            // Create new card
            createCard('英単語', 'banana', 'バナナ');

            // Verify
            const allCards = loadCards();
            expect(allCards.length).toBe(2);
            expect(allCards[1].id).toBeDefined();
            expect(allCards[1].id).not.toBe('existing-1');
            expect(allCards[1].question).toBe('banana');
        });

        test('creates 1000 cards without ID collision', () => {
            const idsSet = new Set();

            for (let i = 0; i < 1000; i++) {
                createCard('テスト', `question${i}`, `answer${i}`);
            }

            const cards = loadCards();
            cards.forEach(card => {
                expect(idsSet.has(card.id)).toBe(false);
                idsSet.add(card.id);
            });

            expect(idsSet.size).toBe(1000);
        });
    });

    describe('Migration with Data Corruption', () => {
        test('handles corrupted JSON gracefully', () => {
            localStorage.setItem('MEMORY', '{invalid json}');

            const cards = loadCards();

            expect(cards).toEqual([]);
        });

        test('handles non-array data', () => {
            localStorage.setItem('MEMORY', JSON.stringify({ notAn: 'array' }));

            const cards = loadCards();

            expect(cards).toEqual([]);
        });

        test('handles null values in array', () => {
            localStorage.setItem('MEMORY', JSON.stringify([
                { category: 'test', question: 'q1', answer: 'a1' },
                null,
                { category: 'test', question: 'q2', answer: 'a2' }
            ]));

            const cards = loadCards();

            // Migration should handle null gracefully
            expect(cards.length).toBeGreaterThan(0);
            cards.forEach(card => {
                if (card !== null) {
                    expect(card.id).toBeDefined();
                }
            });
        });

        test('handles cards with missing fields', () => {
            localStorage.setItem('MEMORY', JSON.stringify([
                { question: 'q1', answer: 'a1' }, // Missing category
                { category: 'test', answer: 'a2' }, // Missing question
                { category: 'test', question: 'q3' } // Missing answer
            ]));

            const cards = loadCards();

            // Migration should still add IDs
            expect(cards.length).toBe(3);
            cards.forEach(card => {
                expect(card.id).toBeDefined();
            });
        });
    });

    describe('Performance', () => {
        test('migrates 10000 legacy cards efficiently', () => {
            const largeLegacyDataset = Array.from({ length: 10000 }, (_, i) => ({
                category: `category${i % 10}`,
                question: `question${i}`,
                answer: `answer${i}`
            }));
            localStorage.setItem('MEMORY', JSON.stringify(largeLegacyDataset));

            const startTime = performance.now();
            const cards = loadCards();
            const endTime = performance.now();

            // Verify
            expect(cards.length).toBe(10000);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second

            // Verify all have unique IDs
            const ids = new Set(cards.map(c => c.id));
            expect(ids.size).toBe(10000);
        });
    });
});
