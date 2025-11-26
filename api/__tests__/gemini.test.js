/**
 * @jest-environment node
 */
// tests/unit/gemini.test.js
const { performOCR } = require('../../api/utils/gemini');

describe('gemini.js - performOCR', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        // Spy on console.error to track logging
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        // Mock the global fetch function
        global.fetch = jest.fn();
    });

    afterEach(() => {
        // Restore original console.error and fetch
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('should successfully parse a valid OCR response', async () => {
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{
                        text: JSON.stringify([{ question: 'Q1', answer: 'A1' }])
                    }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse),
        });

        const result = await performOCR('valid-base64-string');

        expect(result).toEqual([{ question: 'Q1', answer: 'A1' }]);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should throw a generic error and log detailed JSON error on failed API call', async () => {
        const mockErrorResponse = {
            error: {
                code: 400,
                message: 'API key not valid. Please pass a valid API key.',
                status: 'INVALID_ARGUMENT'
            }
        };

        // Configure fetch to simulate a failed response
        global.fetch.mockResolvedValue({
            ok: false,
            status: 400,
            json: jest.fn().mockResolvedValue(mockErrorResponse),
            text: jest.fn().mockResolvedValue(JSON.stringify(mockErrorResponse))
        });

        // Expect the function to throw a generic error that includes the status code
        const errorPromise = performOCR('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 400 - API request failed');
        await expect(errorPromise).rejects.toThrow(/400/);


        // Verify that the detailed error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini API error details:', mockErrorResponse);
    });

    it('should throw a generic error and log detailed text error on failed API call', async () => {
        const errorText = 'Internal Server Error';

        // Configure fetch to simulate a failed response with non-JSON body
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
            text: jest.fn().mockResolvedValue(errorText)
        });

        // Expect the function to throw a generic error that includes the status code
        const errorPromise = performOCR('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 500 - API request failed');
        await expect(errorPromise).rejects.toThrow(/500/);


        // Verify that the detailed text error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini API error details (Text):', errorText);
    });

    it('should handle cases where reading the error body fails', async () => {
        // Configure fetch to simulate a failure in reading the response body
        global.fetch.mockResolvedValue({
            ok: false,
            status: 502,
            json: jest.fn().mockRejectedValue(new Error('Network error')),
            text: jest.fn().mockRejectedValue(new Error('Network error'))
        });

        // Expect the function to throw a generic error that includes the status code
        const errorPromise = performOCR('some-base64-string');
        await expect(errorPromise).rejects.toThrow('Gemini API error: 502 - API request failed');
        await expect(errorPromise).rejects.toThrow(/502/);

        // Verify that a fallback message was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith('Could not read Gemini API response body');
    });

    it('should throw generic error and log details when response is not an array', async () => {
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: '{"key": "value"}' }] // Valid JSON, not array
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse),
        });

        await expect(performOCR('base64')).rejects.toThrow('Invalid response format from Gemini API');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Gemini response is not an array:', '{"key": "value"}');
    });

    it('should throw generic error and log details when JSON parsing fails', async () => {
        const mockApiResponse = {
            candidates: [{
                content: {
                    parts: [{ text: '{invalid json}' }]
                }
            }]
        };

        global.fetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockApiResponse),
        });

        await expect(performOCR('base64')).rejects.toThrow('Invalid response format from Gemini API');
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to parse Gemini response:',
            expect.any(String),
            '{invalid json}'
        );
    });
});