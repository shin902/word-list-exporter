/**
 * Integration tests for OCR workflow
 * Tests the complete flow from image selection to card creation
 */

const {
    parseTextToCards,
    // performOCR is not exported by app.js.
    // app.js defines performOCR for frontend, but it calls fetch('/api/ocr').
    // The test seems to assume performOCR is available globally or calls the client-side function.
    // However, in app.js, performOCR is defined as:
    /*
    async function performOCR(canvas) {
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        const response = await fetch('/api/ocr', ...);
        ...
    }
    */
    // It does NOT call Gemini API directly from client anymore in the current implementation (it calls backend).
    // The test code mocks `fetch` to return Gemini API structure (`candidates`, etc.), which suggests the test expects `performOCR` to call Gemini directly OR the backend to return that structure.
    // BUT, `api/routes/ocr.js` returns:
    /*
    res.json({
        success: true,
        text: result
    });
    */
    // And `performOCR` in `app.js` parses that:
    /*
    const data = await response.json();
    return data.text;
    */
    // So the test is mocking the WRONG response structure if it's testing the client-side `performOCR`.
    // The test is mocking `fetch` to return Gemini structure, but `performOCR` calls `/api/ocr`.
    // AND `performOCR` is not exported in my previous `app.js` edit.
    // I need to export `performOCR` from `app.js`.
    // AND I need to fix the test expectations to match what `performOCR` expects from `/api/ocr`.
    performOCR
} = require('../../public/app');

describe('OCR Workflow Integration', () => {
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

    describe('Successful OCR Flow', () => {
        test('processes image and creates cards from API response', async () => {
            // Setup
            // performOCR calls /api/ocr, which returns { success: true, text: '...' }
            const mockResponse = {
                success: true,
                text: 'apple→りんご\nbanana→バナナ\norange→オレンジ'
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
            const text = await performOCR(canvas);
            const cards = parseTextToCards(text);

            // Verify
            expect(text).toBe('apple→りんご\nbanana→バナナ\norange→オレンジ');
            expect(cards.length).toBe(3);
            expect(cards[0].question).toBe('apple');
            expect(cards[0].answer).toBe('りんご');
            expect(cards[0].id).toBeDefined();
            expect(cards[0].category).toBe('英単語');
        });

        test('handles multiple text formats in single OCR response', async () => {
            const mockResponse = {
                success: true,
                text: 'apple→りんご\nbanana バナナ\norange:オレンジ\ngrape-ぶどう'
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            const canvas = document.createElement('canvas');
            const text = await performOCR(canvas);
            const cards = parseTextToCards(text);

            expect(cards.length).toBe(4);
            expect(cards.map(c => c.question)).toEqual(['apple', 'banana', 'orange', 'grape']);
        });
    });

    describe('Error Handling', () => {
        // Note: performOCR in app.js does NOT check for GEMINI_API_KEY anymore because it delegates to backend.
        // So tests checking for "Gemini API Keyが設定されていません" are invalid for the current client-side code.
        // I will remove authentication tests that assume client-side key handling.

        test('handles backend error (400/500)', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ error: 'Invalid image' })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow('Invalid image');
        });

        test('handles "NONE" response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ text: 'NONE' })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow('赤字のテキストが見つかりませんでした');
        });

        test('handles network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow('Network error');
        });
    });

    describe('API Request Format', () => {
        test('sends correct headers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true, text: 'test' })
            });

            const canvas = document.createElement('canvas');
            await performOCR(canvas);

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/ocr',
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
                json: async () => ({ success: true, text: 'test' })
            });

            const canvas = document.createElement('canvas');
            await performOCR(canvas);

            const callArgs = mockFetch.mock.calls[0][1];
            const body = JSON.parse(callArgs.body);

            expect(body).toHaveProperty('image');
            expect(body.image).toContain('data:image/jpeg;base64');
        });
    });
});
