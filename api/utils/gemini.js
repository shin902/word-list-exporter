// const fetch = require('node-fetch'); // Node.js 18+ has native fetch

const { GEMINI_API_KEY } = require('../config');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function performOCR(base64Image) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `画像から英文と日本語訳を抽出してください。
赤色のテキストのみを対象としてください。
各ペアを配列として返してください。`;

    const schema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "英文"
                },
                answer: {
                    type: "string",
                    description: "日本語訳"
                }
            },
            required: ["question", "answer"]
        }
    };

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: 'image/jpeg',
                        data: base64Image
                    }
                }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: schema
        }
    };

    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        // Log the detailed error for server-side debugging, then throw a generic error.
        try {
            const errorBody = await response.json();
            console.error('Gemini API error details:', errorBody);
        } catch (jsonError) {
            try {
                const errorText = await response.text();
                console.error('Gemini API error details (Text):', errorText);
            } catch (textError) {
                console.error('Could not read Gemini API response body');
            }
        }

        // Throw a generic error. The status code is intentionally included
        // as it is used by the downstream errorHandler to provide more specific,
        // safe error messages to the client (e.g., for rate limiting).
        throw new Error(`Gemini API error: ${response.status} - API request failed`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
    }

    const text = data.candidates[0].content.parts?.[0]?.text;

    if (!text) {
        throw new Error('Invalid response format from Gemini API: missing text');
    }

    // Parse and validate JSON response
    try {
        const cards = JSON.parse(text);
        if (!Array.isArray(cards)) {
            throw new Error('Response is not an array');
        }
        return cards; // Return array of {question, answer} objects directly
    } catch (e) {
        throw new Error(`Failed to parse JSON response: ${e.message}`);
    }
}

module.exports = { performOCR };
