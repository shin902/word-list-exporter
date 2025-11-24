const request = require('supertest');
const app = require('../api/index');
const gemini = require('../api/utils/gemini');

// Mock the Gemini API utils
jest.mock('../api/utils/gemini', () => ({
    performOCR: jest.fn().mockResolvedValue([])
}));

describe('Vuln-003: Incomplete Base64 Validation', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should reject invalid Base64 characters with 400', async () => {
        const invalidBase64 = "ThisIsNotValidBase64!!!@@@###";

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/jpeg;base64,${invalidBase64}` });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('無効なBase64形式です');
        expect(gemini.performOCR).not.toHaveBeenCalled();
    });

    it('should accept valid Base64 string', async () => {
        // "Hello" in base64 is "SGVsbG8="
        const validBase64 = "SGVsbG8=";

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/jpeg;base64,${validBase64}` });

        expect(res.status).toBe(200);
        expect(gemini.performOCR).toHaveBeenCalled();
    });
});
