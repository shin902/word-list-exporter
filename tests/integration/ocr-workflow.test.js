/**
 * Integration tests for OCR workflow
 * Tests the complete flow from image selection to card creation
 */

describe('OCR Workflow Integration', () => {
    let mockFetch;

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = `
            <input id="import-category-input" value="英単語" />
            <div id="import-status"></div>
            <div id="import-preview"></div>
        `;

        // Mock fetch for Gemini API
        mockFetch = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
        mockFetch.mockRestore();
    });

    describe('Successful OCR Flow', () => {
        test('processes image and creates cards from API response', async () => {
            // Setup
            const mockApiKey = 'AIza' + 'x'.repeat(35);
            localStorage.setItem('GEMINI_API_KEY', mockApiKey);

            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: 'apple→りんご\nbanana→バナナ\norange→オレンジ'
                        }]
                    }
                }]
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
            const mockApiKey = 'AIza' + 'x'.repeat(35);
            localStorage.setItem('GEMINI_API_KEY', mockApiKey);

            const mockResponse = {
                candidates: [{
                    content: {
                        parts: [{
                            text: 'apple→りんご\nbanana バナナ\norange:オレンジ\ngrape-ぶどう'
                        }]
                    }
                }]
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
        test('throws error when API key is missing', async () => {
            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'Gemini API Keyが設定されていません'
            );
        });

        test('handles rate limit error (429)', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests'
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'APIのリクエスト上限に達しました'
            );
        });

        test('handles authentication error (401)', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'invalid_key');

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'API Keyが無効です'
            );
        });

        test('handles malformed API response - missing candidates', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}) // No candidates
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'candidates配列が存在しません'
            );
        });

        test('handles malformed API response - empty candidates array', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ candidates: [] })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'candidates配列が存在しません'
            );
        });

        test('handles malformed API response - missing parts', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {}
                    }]
                })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'parts配列が存在しません'
            );
        });

        test('handles malformed API response - missing text', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ noText: 'here' }]
                        }
                    }]
                })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'テキストデータが存在しません'
            );
        });

        test('handles empty text response', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: '   ' }]
                        }
                    }]
                })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'APIから空のレスポンスが返されました'
            );
        });

        test('handles oversized response', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            const largeText = 'a'.repeat(100001);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: largeText }]
                        }
                    }]
                })
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'レスポンスが大きすぎます'
            );
        });

        test('handles network error', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow('Network error');
        });

        test('handles invalid JSON response', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                }
            });

            const canvas = document.createElement('canvas');

            await expect(performOCR(canvas)).rejects.toThrow(
                'レスポンスの解析に失敗しました'
            );
        });
    });

    describe('API Request Format', () => {
        test('sends correct headers with API key', async () => {
            const mockApiKey = 'AIza' + 'x'.repeat(35);
            localStorage.setItem('GEMINI_API_KEY', mockApiKey);

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: 'test' }]
                        }
                    }]
                })
            });

            const canvas = document.createElement('canvas');
            await performOCR(canvas);

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'x-goog-api-key': mockApiKey
                    })
                })
            );
        });

        test('sends base64 encoded image', async () => {
            localStorage.setItem('GEMINI_API_KEY', 'AIza' + 'x'.repeat(35));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: 'test' }]
                        }
                    }]
                })
            });

            const canvas = document.createElement('canvas');
            await performOCR(canvas);

            const callArgs = mockFetch.mock.calls[0][1];
            const body = JSON.parse(callArgs.body);

            expect(body.contents[0].parts).toHaveLength(2);
            expect(body.contents[0].parts[0]).toHaveProperty('text');
            expect(body.contents[0].parts[1]).toHaveProperty('inline_data');
            expect(body.contents[0].parts[1].inline_data).toHaveProperty('mime_type', 'image/png');
            expect(body.contents[0].parts[1].inline_data).toHaveProperty('data');
        });
    });
});
