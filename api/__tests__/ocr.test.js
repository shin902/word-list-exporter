/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../index');

// Mock the gemini utils
jest.mock('../utils/gemini', () => ({
    performOCR: jest.fn()
}));

const { performOCR } = require('../utils/gemini');

describe('POST /api/ocr', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return error when no image provided', async () => {
        const response = await request(app)
            .post('/api/ocr')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('画像データが必要です');
    });

    it('should return error for invalid image format', async () => {
        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('無効な画像形式です');
    });

    it('should return error when base64 data is missing', async () => {
        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg,' }); // Empty data

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('画像データの解析に失敗しました');
    });

    // Note: Strict base64 validation was removed to prevent ReDoS attacks on large payloads
    // It now relies on performOCR or decoding to handle invalid data
    /*
    it('should return error for invalid base64 characters', async () => {
        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,invalid@base64' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('無効なBase64データです');
    });
    */

    it('should accept base64 data with spaces (RFC 4648 compliant)', async () => {
        const mockText = '問題:答え';
        performOCR.mockResolvedValue(mockText);

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,valid base64 data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.text).toBe(mockText);
        // Verify whitespace is stripped before calling performOCR
        expect(performOCR).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with newlines', async () => {
        const mockText = '問題:答え';
        performOCR.mockResolvedValue(mockText);

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,valid\nbase64\ndata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.text).toBe(mockText);
        expect(performOCR).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with tabs', async () => {
        const mockText = '問題:答え';
        performOCR.mockResolvedValue(mockText);

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,valid\tbase64\tdata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.text).toBe(mockText);
        expect(performOCR).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with mixed whitespace', async () => {
        const mockText = '問題:答え';
        performOCR.mockResolvedValue(mockText);

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,valid \n\tbase64 \r\ndata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.text).toBe(mockText);
        expect(performOCR).toHaveBeenCalledWith('validbase64data');
    });

    it('should return success with text when OCR is successful', async () => {
        const mockText = '問題:答え';
        performOCR.mockResolvedValue(mockText);

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,validbase64data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.text).toBe(mockText);
        expect(performOCR).toHaveBeenCalledWith('validbase64data');
    });

    it('should handle errors from performOCR', async () => {
        performOCR.mockRejectedValue(new Error('Gemini API error'));

        const response = await request(app)
            .post('/api/ocr')
            .send({ image: 'data:image/jpeg;base64,validbase64data' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBeDefined();
    });
});
