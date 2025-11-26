/**
 * @jest-environment node
 */

const { performOCR } = require('../utils/gemini');

// global.fetch is available in Node.js 18+ and the Jest 'node' environment
// We spy on it to mock its implementation
const fetchSpy = jest.spyOn(global, 'fetch');

describe('performOCR', () => {
    beforeEach(() => {
        // Clear mock history before each test
        fetchSpy.mockClear();
        // Mock environment variable
        process.env.GEMINI_API_KEY = 'test-key';
    });

    afterAll(() => {
        // Restore original fetch implementation
        fetchSpy.mockRestore();
    });

    it('should throw a generic error when Gemini API returns invalid JSON', async () => {
        // Mock a successful response with invalid JSON in the content part
        const mockApiResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            text: 'this is not valid json'
                        }]
                    }
                }]
            })
        };
        fetchSpy.mockResolvedValue(mockApiResponse);

        // We expect the function to reject with a specific, generic error message
        await expect(performOCR('some-base64-data')).rejects.toThrow('Invalid response format from Gemini API');
    });

    it('should return parsed cards when Gemini API returns valid JSON', async () => {
        const validCards = [
            { question: 'hello', answer: 'こんにちは' }
        ];
        const mockApiResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify(validCards)
                        }]
                    }
                }]
            })
        };
        fetchSpy.mockResolvedValue(mockApiResponse);

        const result = await performOCR('some-base64-data');
        expect(result).toEqual(validCards);
    });

    it('should throw a generic error when the response format is unexpected (not an array)', async () => {
        const invalidResponse = { card: 'invalid' }; // Should be an array
        const mockApiResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify(invalidResponse)
                        }]
                    }
                }]
            })
        };
        fetchSpy.mockResolvedValue(mockApiResponse);

        await expect(performOCR('some-base64-data')).rejects.toThrow('Invalid response format from Gemini API');
    });
});
