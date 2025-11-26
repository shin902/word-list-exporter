/**
 * @jest-environment node
 */
const request = require('supertest');
const express = require('express');
const errorHandler = require('../../api/middleware/errorHandler');

describe('Error Handler Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return a generic message for detailed errors', async () => {
        app.get('/test', (req, res) => {
            throw new Error('Internal server error with sensitive data: API_KEY=abc123');
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
        expect(response.body.error).not.toContain('API_KEY');
        expect(response.body.errorId).toBeDefined();
    });

    it('should return a generic message instead of exposing filesystem paths', async () => {
        const actualPath = __filename;
        app.get('/test', (req, res) => {
            throw new Error(`Failed to load ${actualPath}/config.json`);
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
        expect(response.body.error).not.toContain(actualPath);
    });

    it('should handle specific API errors correctly', async () => {
        app.get('/test', (req, res) => {
            throw new Error('Gemini API error: 429 - Rate limit exceeded');
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(429);
        expect(response.body.error).toBe('APIのリクエスト上限に達しました。しばらくしてから再試行してください。');
    });

    it('should handle errors with status codes', async () => {
        app.post('/test', (req, res) => {
            const err = new Error('Request entity too large');
            err.status = 413;
            err.type = 'entity.too.large';
            throw err;
        });
        app.use(errorHandler);

        const response = await request(app).post('/test').send({ data: 'test' });

        expect(response.status).toBe(413);
        expect(response.body.error).toBe('リクエストのペイロードが大きすぎます。');
        expect(response.body.errorId).toBeDefined();
    });

    it('should generate unique error IDs for concurrent requests', async () => {
        app.get('/error1', (req, res) => { throw new Error('Error 1'); });
        app.get('/error2', (req, res) => { throw new Error('Error 2'); });
        app.use(errorHandler);

        const [response1, response2] = await Promise.all([
            request(app).get('/error1'),
            request(app).get('/error2')
        ]);

        expect(response1.body.errorId).toBeDefined();
        expect(response2.body.errorId).toBeDefined();
        expect(response1.body.errorId).not.toBe(response2.body.errorId);
    });

    it('should return 429 for rate limit errors', async () => {
        app.get('/test', (req, res) => {
            const err = new Error('Too many requests');
            err.status = 429;
            throw err;
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(429);
        expect(response.body.error).toBe('リクエストが多すぎます。しばらくしてから再試行してください。');
    });

    it('should return 404 for not found errors', async () => {
        app.get('/test', (req, res) => {
            const err = new Error('Not found');
            err.status = 404;
            throw err;
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('リソースが見つかりません。');
    });

    it('should return 502 for bad gateway errors', async () => {
        app.get('/test', (req, res) => {
            const err = new Error('Bad gateway');
            err.status = 502;
            throw err;
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(502);
        expect(response.body.error).toBe('ゲートウェイエラーが発生しました。');
    });

    it('should return 503 for service unavailable errors', async () => {
        app.get('/test', (req, res) => {
            const err = new Error('Service unavailable');
            err.status = 503;
            throw err;
        });
        app.use(errorHandler);

        const response = await request(app).get('/test');

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('サービスが一時的に利用できません。');
    });
});
