
const gemini = require('../../api/utils/gemini');
const { performOCR } = gemini;

// Mock the config
jest.mock('../../api/config', () => ({
    GEMINI_API_KEY: 'test-key'
}));

// Mock fetch
global.fetch = jest.fn();

describe('gemini.js performOCR', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should use default prompt (en-ja) when mode is not specified', async () => {
        // Mock successful response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: '[{"question":"apple", "answer":"りんご"}]'
                        }]
                    }
                }]
            })
        });

        await performOCR('base64image');

        // Verify request body
        const callArgs = global.fetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        const prompt = requestBody.contents[0].parts[0].text;

        expect(prompt).toContain('「英文」と「日本語訳」のペアを抽出してください');
    });

    it('should use Japanese->English prompt when mode is ja-en', async () => {
        // Mock successful response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: '[{"question":"りんご", "answer":"apple"}]'
                        }]
                    }
                }]
            })
        });

        await performOCR('base64image', 'ja-en');

        // Verify request body
        const callArgs = global.fetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        const prompt = requestBody.contents[0].parts[0].text;
        const schema = requestBody.generationConfig.responseJsonSchema;

        expect(prompt).toContain('「日本文」と「英訳」のペアを抽出してください');
        expect(schema.items.properties.question.description).toBe('日本文');
        expect(schema.items.properties.answer.description).toBe('英訳');
    });

    it('should use English->Japanese prompt when mode is en-ja', async () => {
        // Mock successful response
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{
                    content: {
                        parts: [{
                            text: '[{"question":"apple", "answer":"りんご"}]'
                        }]
                    }
                }]
            })
        });

        await performOCR('base64image', 'en-ja');

        // Verify request body
        const callArgs = global.fetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);
        const prompt = requestBody.contents[0].parts[0].text;

        expect(prompt).toContain('「英文」と「日本語訳」のペアを抽出してください');
    });
});
