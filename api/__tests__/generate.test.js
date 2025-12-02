/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../index');

// Mock the gemini utils
jest.mock('../utils/gemini', () => ({
    generateCards: jest.fn()
}));

const { generateCards } = require('../utils/gemini');

describe('POST /api/generate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Clean up timer to prevent "worker has failed to exit gracefully" warning
        const { clearTimer } = require('../routes/generate');
        if (typeof clearTimer === 'function') {
            clearTimer();
        }
    });

    it('should return error when no image provided', async () => {
        const response = await request(app)
            .post('/api/generate')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('画像データが必要です');
    });

    it('should return error for invalid image format', async () => {
        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('無効な画像形式です');
    });

    it('should return error when base64 data is missing', async () => {
        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg,' }); // Empty data

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('画像データの解析に失敗しました');
    });

    it('should accept base64 data with spaces (RFC 4648 compliant)', async () => {
        const mockCards = [{ question: 'Q', answer: 'A' }];
        generateCards.mockResolvedValue(mockCards);

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,valid base64 data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cards).toEqual(mockCards);
        // Verify whitespace is stripped before calling generateCards
        expect(generateCards).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with newlines', async () => {
        const mockCards = [{ question: 'Q', answer: 'A' }];
        generateCards.mockResolvedValue(mockCards);

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,valid\nbase64\ndata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cards).toEqual(mockCards);
        expect(generateCards).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with tabs', async () => {
        const mockCards = [{ question: 'Q', answer: 'A' }];
        generateCards.mockResolvedValue(mockCards);

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,valid\tbase64\tdata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cards).toEqual(mockCards);
        expect(generateCards).toHaveBeenCalledWith('validbase64data');
    });

    it('should accept base64 data with mixed whitespace', async () => {
        const mockCards = [{ question: 'Q', answer: 'A' }];
        generateCards.mockResolvedValue(mockCards);

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,valid \n\tbase64 \r\ndata' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cards).toEqual(mockCards);
        expect(generateCards).toHaveBeenCalledWith('validbase64data');
    });

    it('should return success with cards when generation is successful', async () => {
        const mockCards = [{ question: 'Q', answer: 'A' }];
        generateCards.mockResolvedValue(mockCards);

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,validbase64data' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.cards).toEqual(mockCards);
        expect(generateCards).toHaveBeenCalledWith('validbase64data');
    });

    it('should handle errors from generateCards', async () => {
        generateCards.mockRejectedValue(new Error('Gemini API error'));

        const response = await request(app)
            .post('/api/generate')
            .send({ image: 'data:image/jpeg;base64,validbase64data' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBeDefined();
    });
});
