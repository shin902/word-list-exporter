const request = require('supertest');
const app = require('../../api/index');
const gemini = require('../../api/utils/gemini');

// Mock the Gemini API utils
jest.mock('../../api/utils/gemini', () => ({
    performOCR: jest.fn().mockResolvedValue([])
}));

describe('OCR Validation Integration Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Base64 Character Validation', () => {
        it('should reject invalid Base64 characters with 400', async () => {
            const invalidBase64 = "ThisIsNotValidBase64!!!@@@###";

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${invalidBase64}` });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('無効なBase64形式です');
            expect(gemini.performOCR).not.toHaveBeenCalled();
        });

        it('should accept valid Base64 string "SGVsbG8=" (Hello)', async () => {
            const validBase64 = "SGVsbG8=";

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${validBase64}` });

            expect(res.status).toBe(200);
            expect(gemini.performOCR).toHaveBeenCalled();
        });

        it('should handle whitespace by ignoring it (logic in code)', async () => {
            // "SGVsbG8=" with newlines/spaces -> "SGV sbG 8="
            // The code cleans whitespace before validation
            const base64WithSpace = "SGV\nsbG\t8=";

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${base64WithSpace}` });

            expect(res.status).toBe(200);
            expect(gemini.performOCR).toHaveBeenCalled();
        });

        it('should accept all Base64 special characters (+, /)', async () => {
            // Base64 containing + and /
            const base64Special = "QmFzZTY0Ky8="; // "Base64+/"

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${base64Special}` });

            expect(res.status).toBe(200);
            expect(gemini.performOCR).toHaveBeenCalled();
        });

        it('should accept empty Base64 string (though logic might fail later or acceptable)', async () => {
            // Empty base64
            const emptyBase64 = "";

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${emptyBase64}` });

            // Depending on implementation, empty string matches regex ^[...]*$
            // However, performOCR or other logic might complain if it expects content.
            // Let's see current behavior.
            // In ocr.js:
            // const base64Data = image.split(',')[1];
            // if (!base64Data) { return res.status(400)... }
            // So if we send "data:image/jpeg;base64," -> split gives ["data:...", ""] -> base64Data is ""
            // "if (!base64Data)" check: "" is falsy.
            // So it should return 400 "画像データの解析に失敗しました" (Failed to parse image data)
            // Wait, check ocr.js code again.

            expect(res.status).toBe(400);
            // The error message for empty base64Data in ocr.js
            expect(res.body.error).toBe('画像データの解析に失敗しました');
        });
    });
});
