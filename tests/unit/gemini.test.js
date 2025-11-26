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

        // Expect the function to throw a generic error
        await expect(performOCR('some-base64-string')).rejects.toThrow('Gemini API error: 400 - API request failed');

        // Verify that the detailed error was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Gemini API error details (JSON):',
            JSON.stringify(mockErrorResponse, null, 2)
        );
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

        // Expect the function to throw a generic error
        await expect(performOCR('some-base64-string')).rejects.toThrow('Gemini API error: 500 - API request failed');

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

        // Expect the function to throw a generic error
        await expect(performOCR('some-base64-string')).rejects.toThrow('Gemini API error: 502 - API request failed');

        // Verify that a fallback message was logged
        expect(consoleErrorSpy).toHaveBeenCalledWith('Could not read Gemini API response body');
    });
});
