/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../../api/index');

describe('Body Parser Error Handling', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return 400 for malformed JSON', async () => {
        const response = await request(app)
            .post('/api/generate')
            .set('Content-Type', 'application/json')
            .send('{"image": "test",}'); // Malformed JSON with trailing comma

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('リクエストのJSON形式が正しくありません。');
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Invalid JSON in request body'),
            expect.any(Object)
        );
    });

    it('should return 413 for payloads exceeding the 1.5mb limit', async () => {
        const largePayload = { image: 'a'.repeat(2 * 1024 * 1024) }; // ~2MB

        const response = await request(app)
            .post('/api/generate')
            .send(largePayload);

        expect(response.status).toBe(413);
        expect(response.body.error).toBe('リクエストのペイロードが大きすぎます。');
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Request entity too large'),
            expect.any(Object)
        );
    });
});
