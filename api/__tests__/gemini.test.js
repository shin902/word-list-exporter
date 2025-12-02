/**
 * @jest-environment node
 */
const { generateCards } = require('../utils/gemini');

const originalFetch = global.fetch;

describe('generateCards', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = jest.fn();
        process.env.GEMINI_API_KEY = 'test-key';
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.resetAllMocks();
        delete process.env.GEMINI_API_KEY;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it('returns parsed cards when Gemini API responds with valid JSON array', async () => {
        const validCards = [{ question: 'hello', answer: 'こんにちは' }];
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: JSON.stringify(validCards) }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse)
        });

        const result = await generateCards('some-base64-data');
        expect(result).toEqual(validCards);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('throws a generic error when Gemini API returns invalid JSON', async () => {
        const invalidPayload = {
            candidates: [{
                content: {
                    parts: [{ text: 'this is not valid json' }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(invalidPayload)
        });

        await expect(generateCards('some-base64-data')).rejects.toThrow('Invalid response format from Gemini API');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to parse Gemini response:',
            expect.any(String),
            'this is not valid json'
        );
    });

    it('throws a generic error when the response is not an array', async () => {
        const invalidResponse = { card: 'invalid' };
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: JSON.stringify(invalidResponse) }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse)
        });

        await expect(generateCards('some-base64-data')).rejects.toThrow('Invalid response format from Gemini API');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini response is not an array:', JSON.stringify(invalidResponse));
    });

    it('throws a generic error and logs JSON body when API call fails', async () => {
        const mockErrorResponse = {
            error: {
                code: 400,
                message: 'API key not valid. Please pass a valid API key.',
                status: 'INVALID_ARGUMENT'
            }
        };

        global.fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: jest.fn().mockResolvedValue(mockErrorResponse),
            text: jest.fn().mockResolvedValue(JSON.stringify(mockErrorResponse))
        });

        const errorPromise = generateCards('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 400 - API request failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini API error details:', mockErrorResponse);
    });

    it('logs text body when JSON parsing of error response fails', async () => {
        const errorText = 'Internal Server Error';

        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
            text: jest.fn().mockResolvedValue(errorText)
        });

        const errorPromise = generateCards('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 500 - API request failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini API error details (Text):', errorText);
    });

    it('logs fallback message when error body cannot be read', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 502,
            json: jest.fn().mockRejectedValue(new Error('Network error')),
            text: jest.fn().mockRejectedValue(new Error('Network error'))
        });

        const errorPromise = generateCards('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 502 - API request failed');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Could not read Gemini API response body');
    });

    it('does not expose JSON parse position details to client', async () => {
        const invalidJson = '{"question": "test", "answer": "test"';
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: invalidJson }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse)
        });

        await expect(generateCards('some-base64-data')).rejects.toThrow('Invalid response format from Gemini API');

        try {
            await generateCards('some-base64-data');
            fail('generateCards should have thrown an error');
        } catch (e) {
            expect(e.message).not.toMatch(/position \d+/);
            expect(e.message).not.toMatch(/Unexpected token/i);
        }

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to parse Gemini response:',
            expect.stringMatching(
                /Unexpected end of JSON input|Unexpected token|Expected .* in JSON/i
            ),
            invalidJson
        );
    });
});
