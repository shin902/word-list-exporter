/**
 * @jest-environment node
 */
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

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('画像データの解析に失敗しました');
        });

        it('should reject whitespace-only Base64 data', async () => {
            // "   \n  " -> cleaned becomes ""
            // Regex ^[...]*$ matches "", so previously it would pass validation
            // But we should reject it as empty data
            const whitespaceBase64 = "   \n  \t  ";

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${whitespaceBase64}` });

            expect(res.status).toBe(400);
            // We expect this to hit the new check we will add
            expect(res.body.error).toBe('画像データの解析に失敗しました');
        });

        it('should accept large valid Base64 payload (within limit)', async () => {
            // 0.8MB Base64 string (within 1MB limit)
            // 'a' is valid base64 char
            const largeBase64 = 'a'.repeat(0.8 * 1024 * 1024);

            const res = await request(app)
                .post('/api/ocr')
                .send({ image: `data:image/jpeg;base64,${largeBase64}` });

            expect(res.status).toBe(200);
            expect(gemini.performOCR).toHaveBeenCalled();
        }, 10000); // Increase timeout for large payload
    });

    afterAll(() => {
        // Clean up timer to prevent "worker has failed to exit gracefully" warning
        const { clearTimer } = require('../../api/routes/ocr');
        if (typeof clearTimer === 'function') {
            clearTimer();
        }
    });
});
