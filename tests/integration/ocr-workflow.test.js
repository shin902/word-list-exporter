/**
 * @jest-environment jsdom
 */
/**
 * Integration tests for Generate Cards workflow
 * Tests the complete flow from image selection to card creation
 */

const {
    generateCardsFromImage
} = require('../../public/app');

describe('Generate Cards Workflow Integration', () => {
    let mockFetch;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `
            <input id="import-category-input" value="英単語" />
            <div id="import-status"></div>
            <div id="import-preview"></div>
        `;

        // Mock fetch
        global.fetch = jest.fn();
        mockFetch = global.fetch;

        // Mock canvas.toDataURL since jsdom canvas implementation might be limited
        HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/jpeg;base64,mockdata');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Successful Generation Flow', () => {
        test('processes image and creates cards from API response', async () => {
            // Setup
            // generateCardsFromImage calls /api/generate, which returns { success: true, cards: [...] }
            const mockCards = [
                { question: 'apple', answer: 'りんご' },
                { question: 'banana', answer: 'バナナ' },
                { question: 'orange', answer: 'オレンジ' }
            ];

            const mockResponse = {
                success: true,
                cards: mockCards
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            // Create mock canvas
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;

            // Execute
            const cards = await generateCardsFromImage(canvas);

            // Verify
            expect(cards.length).toBe(3);
            expect(cards[0].question).toBe('apple');
            expect(cards[0].answer).toBe('りんご');
        });
    });

    describe('Error Handling', () => {
        test('handles backend error (400/500)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid image' })
            });

            const canvas = document.createElement('canvas');

            await expect(generateCardsFromImage(canvas)).rejects.toThrow('Invalid image');
        });

        test('handles empty response (no cards)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ cards: [] })
            });

            const canvas = document.createElement('canvas');

            await expect(generateCardsFromImage(canvas)).rejects.toThrow('赤字のテキストが見つかりませんでした');
        });

        test('handles network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const canvas = document.createElement('canvas');

            await expect(generateCardsFromImage(canvas)).rejects.toThrow('Network error');
        });
    });

    describe('API Request Format', () => {
        test('sends correct headers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, cards: [{ question: 'test', answer: 'test' }] })
            });

            const canvas = document.createElement('canvas');
            await generateCardsFromImage(canvas);

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/generate',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            );
        });

        test('sends base64 encoded image in body', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, cards: [{ question: 'test', answer: 'test' }] })
            });

            const canvas = document.createElement('canvas');
            await generateCardsFromImage(canvas);

            const callArgs = mockFetch.mock.calls[0][1];
            const body = JSON.parse(callArgs.body);

            expect(body).toHaveProperty('image');
            expect(body.image).toContain('data:image/jpeg;base64');
        });
    });
});
