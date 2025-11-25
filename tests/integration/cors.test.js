/**
 * @jest-environment node
 */
const request = require('supertest');
const path = require('path');

describe('CORS Configuration', () => {
    let originalEnv;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        jest.resetModules();
        originalEnv = { ...process.env };
        
        // Mock dotenv to prevent it from loading .env file during tests
        jest.mock('dotenv', () => ({
            config: jest.fn()
        }));
        
        // Ensure we don't have lingering env vars affecting tests
        delete process.env.FRONTEND_URL;
        delete process.env.NODE_ENV;
        delete process.env.KV_URL;
        delete process.env.REDIS_URL;
        // Mock console methods BEFORE requiring the module to capture all logs
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Silence error logs during tests
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
        jest.unmock('dotenv');
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

        require('../../api/index');

        // Filter out dotenv logs and check for our specific log message
        const logCalls = consoleLogSpy.mock.calls.map(call => call[0]);
        const hasInfoMessage = logCalls.some(msg => 
            typeof msg === 'string' && msg.includes('INFO: Using default CORS origin')
        );
        expect(hasInfoMessage).toBe(true);
    });

    test('should not log info message when FRONTEND_URL is set in development', async () => {
        process.env.NODE_ENV = 'development';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.FRONTEND_URL = 'http://localhost:8080';

        require('../../api/index');

        const logCalls = consoleLogSpy.mock.calls.map(call => call[0]);
        const hasInfoMessage = logCalls.some(msg => 
            typeof msg === 'string' && msg.includes('INFO: Using default CORS origin')
        );
        expect(hasInfoMessage).toBe(false);
    });

    test('should block requests from unknown origins when FRONTEND_URL not set in test environment', async () => {
        process.env.NODE_ENV = 'test';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        // Should NOT log a warning about FRONTEND_URL in test env
        const warnCalls = consoleWarnSpy.mock.calls.map(call => call[0]);
        const hasFrontendUrlWarning = warnCalls.some(msg => 
            typeof msg === 'string' && msg.includes('WARNING: FRONTEND_URL is not set')
        );
        expect(hasFrontendUrlWarning).toBe(false);

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://malicious.com');

        // In test environment without FRONTEND_URL, allowedOrigin is false, so CORS blocks all origins
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should warn when FRONTEND_URL not set in staging environment', async () => {
        process.env.NODE_ENV = 'staging';
        process.env.GEMINI_API_KEY = 'test-key';

        const app = require('../../api/index');

        // Should log a warning
        const warnCalls = consoleWarnSpy.mock.calls.map(call => call[0]);
        const hasFrontendUrlWarning = warnCalls.some(msg => 
            typeof msg === 'string' && msg.includes('WARNING: FRONTEND_URL is not set')
        );
        expect(hasFrontendUrlWarning).toBe(true);

        const res = await request(app)
            .get('/api/health')
            .set('Origin', 'http://malicious.com');

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('should throw error in production when FRONTEND_URL is missing', () => {
        process.env.NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'test-key';
        process.env.KV_URL = 'redis://localhost:6379'; // Redis is required in production now

        // Reset modules to ensure config.js is re-evaluated with new env vars
        jest.resetModules();
        
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

        // Reset modules to ensure config.js is re-evaluated with new env vars
        jest.resetModules();
        
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
