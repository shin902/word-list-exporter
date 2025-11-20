// const fetch = require('node-fetch'); // Node.js 18+ has native fetch

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function performOCR(base64Image) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const prompt = `画像から英単語（または英文）とその日本語訳を抽出してください。
赤色のテキストのみを対象としてください。
各ペアを配列として返してください。`;

    const schema = {
        type: "array",
        items: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "英単語または英文"
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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
    }

    const text = data.candidates[0].content.parts[0].text;

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
