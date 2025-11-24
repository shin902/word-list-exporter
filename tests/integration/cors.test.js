const request = require('supertest');
const path = require('path');

describe('CORS Configuration', () => {
    let originalEnv;

    beforeEach(() => {
        jest.resetModules();
        originalEnv = { ...process.env };
        // Ensure we don't have lingering env vars affecting tests
        delete process.env.FRONTEND_URL;
        delete process.env.NODE_ENV;
        // Mock console.warn to avoid clutter and assert on it
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {}); // Silence error logs during tests
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    test('should use FRONTEND_URL when set', async () => {
        process.env.FRONTEND_URL = 'https://example.com';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'https://example.com');

        expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
    });

    test('should use localhost:5500 in development when FRONTEND_URL not set', async () => {
        process.env.NODE_ENV = 'development';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://localhost:5500');

        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5500');
    });

    test('should log info message in development when using default CORS', async () => {
        process.env.NODE_ENV = 'development';
        process.env.GEMINI_API_KEY = 'test-key';
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        require('../../api/index');

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('INFO: Using default CORS origin')
        );
    });

    test('should not log info message when FRONTEND_URL is set in development', async () => {
        process.env.NODE_ENV = 'development';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.FRONTEND_URL = 'http://localhost:8080';
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        require('../../api/index');

        expect(logSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('INFO: Using default CORS origin')
        );
    });

    test('should block but NOT warn about FRONTEND_URL when not set in test environment', async () => {
        process.env.NODE_ENV = 'test';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        // Should NOT log a warning about FRONTEND_URL in test env
        // Note: ocr.js might log a warning about Redis, so we only check for FRONTEND_URL warning
        expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('WARNING: FRONTEND_URL is not set'));

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://malicious.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should warn when FRONTEND_URL not set in staging environment', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        // Should log a warning
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('WARNING: FRONTEND_URL is not set'));

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://malicious.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should throw error in production when FRONTEND_URL is missing', () => {
        process.env.NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.KV_URL = 'redis://localhost:6379'; // Redis is required in production now

        // We need to catch the error thrown during module require
        expect(() => {
            require('../../api/index');
        }).toThrow('必須の環境変数が設定されていません: FRONTEND_URL');
    });

    test('should throw error in production when Redis is missing', () => {
        process.env.NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.FRONTEND_URL = 'https://production-app.com';
        delete process.env.KV_URL;
        delete process.env.REDIS_URL;

        // We need to catch the error thrown during module require
        expect(() => {
            require('../../api/index');
        }).toThrow('本番環境ではRedis (KV_URL または REDIS_URL) の設定が必須です。');
    });

    test('should accept requests from FRONTEND_URL in production', async () => {
        process.env.NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.FRONTEND_URL = 'https://production-app.com';
        process.env.KV_URL = 'redis://localhost:6379'; // Redis is required in production now

        const app = require('../../api/index');

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'https://production-app.com');

        expect(res.headers['access-control-allow-origin']).toBe('https://production-app.com');
    });
});
