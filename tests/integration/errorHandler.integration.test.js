/**
 * @jest-environment node
 */
const request = require('supertest');
const express = require('express');
const errorHandler = require('../../api/middleware/errorHandler');
const crypto = require('crypto');

// Mock crypto.randomUUID for predictable testing if needed, but not strictly required here
// unless we want to assert the exact format of errorId.

describe('Error Handler Integration Tests', () => {
    let app;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        // Suppress console.error during tests to keep output clean
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    describe('Production Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should sanitize Unix paths in production errors', async () => {
            app.get('/test', (req, res) => {
                const err = new Error('Failed to load /etc/passwd');
                err.status = 400;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(400);
            expect(response.body.error).not.toContain('/etc/passwd');
            // Should use generic message for 400 in production
            expect(response.body.error).toBe('リクエストが不正です。');
            expect(response.body.errorId).toBeDefined();
        });

        it('should sanitize Windows paths in production errors', async () => {
            app.get('/test', (req, res) => {
                const err = new Error('Cannot read C:\\Windows\\System32\\config\\SAM');
                err.status = 500;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(500);
            expect(response.body.error).not.toContain('C:\\Windows');
            expect(response.body.error).not.toContain('System32');
            expect(response.body.errorId).toBeDefined();
        });

        it('should return generic message for 500 errors in production', async () => {
            app.get('/test', (req, res) => {
                throw new Error('Internal server error with sensitive data: API_KEY=abc123');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
            expect(response.body.error).not.toContain('API_KEY');
            expect(response.body.error).not.toContain('abc123');
            expect(response.body.errorId).toBeDefined();
        });

        it('should handle Gemini API errors correctly', async () => {
            app.get('/test', (req, res) => {
                throw new Error('Gemini API error: 429 - Rate limit exceeded');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(429);
            expect(response.body.error).toBe('APIのリクエスト上限に達しました。しばらくしてから再試行してください。');
        });

        it('should handle body-parser errors with status codes', async () => {
            app.post('/test', (req, res) => {
                const err = new Error('request entity too large');
                err.status = 413;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).post('/test').send({ data: 'test' });

            expect(response.status).toBe(413);
            expect(response.body.error).toBe('リクエストのペイロードが大きすぎます。');
            expect(response.body.errorId).toBeDefined();
        });

        it('should include errorId for debugging in production', async () => {
            app.get('/test', (req, res) => {
                throw new Error('Random error');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.body.errorId).toBeDefined();
            expect(typeof response.body.errorId).toBe('string');
            expect(response.body.errorId.length).toBeGreaterThan(0);
        });

        it('should NOT expose sensitive path in error with spaces', async () => {
            app.get('/test', (req, res) => {
                const err = new Error('File not found: /home/user/my documents/secrets.txt');
                err.status = 404;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('リソースが見つかりません。');
            expect(response.body.error).not.toContain('my documents');
            expect(response.body.error).not.toContain('secrets.txt');
        });
    });

    describe('Development Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('should return GENERIC error messages in development for 500 errors', async () => {
            app.get('/test', (req, res) => {
                throw new Error('Detailed error: Failed to connect to database at localhost:5432');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(500);
            // Expect generic message now
            expect(response.body.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
            expect(response.body.error).not.toContain('Detailed error');
            expect(response.body.error).not.toContain('database');
            // Expect errorId now
            expect(response.body.errorId).toBeDefined();
        });

        it('should INCLUDE errorId in development', async () => {
            app.get('/test', (req, res) => {
                throw new Error('Test error');
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.body.errorId).toBeDefined();
        });

        it('should sanitize paths in development when status is present', async () => {
            app.get('/test', (req, res) => {
                const err = new Error('Cannot access /var/log/app.log');
                err.status = 403;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(403);
            // Should contain sanitized path placeholder or be generic
            if (response.body.error.includes('[PATH]')) {
                expect(response.body.error).not.toContain('/var/log/app.log');
            } else {
                expect(response.body.error).toBe('アクセスが拒否されました。');
            }
        });
    });

    describe('Multiple Request Handling', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should handle multiple concurrent errors with unique IDs', async () => {
            app.get('/error1', (req, res) => {
                throw new Error('Error 1');
            });
            app.get('/error2', (req, res) => {
                throw new Error('Error 2');
            });
            app.use(errorHandler);

            const [response1, response2] = await Promise.all([
                request(app).get('/error1'),
                request(app).get('/error2')
            ]);

            expect(response1.body.errorId).toBeDefined();
            expect(response2.body.errorId).toBeDefined();
            expect(response1.body.errorId).not.toBe(response2.body.errorId);
        });
    });

    describe('Status Code Coverage', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        const testCases = [
            { status: 400, expectedMessage: 'リクエストが不正です。' },
            { status: 401, expectedMessage: '認証が必要です。' },
            { status: 403, expectedMessage: 'アクセスが拒否されました。' },
            { status: 404, expectedMessage: 'リソースが見つかりません。' },
            { status: 429, expectedMessage: 'リクエストが多すぎます。しばらくしてから再試行してください。' },
            { status: 500, expectedMessage: 'サーバーエラーが発生しました。' },
            { status: 502, expectedMessage: 'ゲートウェイエラーが発生しました。' },
            { status: 503, expectedMessage: 'サービスが一時的に利用できません。' }
        ];

        testCases.forEach(({ status, expectedMessage }) => {
            it(`should return generic message for ${status} status code`, async () => {
                app.get('/test', (req, res) => {
                    const err = new Error(`Original error message for ${status}`);
                    err.status = status;
                    throw err;
                });
                app.use(errorHandler);

                const response = await request(app).get('/test');

                expect(response.status).toBe(status);
                expect(response.body.error).toBe(expectedMessage);
            });
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should handle thrown string instead of Error object', async () => {
            app.get('/test', (req, res, next) => {
                try {
                    throw 'String error';
                } catch (err) {
                    next(new Error(err));
                }
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(500);
            expect(response.body.error).toBeDefined();
        });

        it('should handle error with very long message', async () => {
            app.get('/test', (req, res) => {
                const longMessage = 'Error: ' + 'a'.repeat(500);
                const err = new Error(longMessage);
                err.status = 400;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(400);
            // Should use generic message for 400
            expect(response.body.error).toBe('リクエストが不正です。');
        });
    });

    describe('Actual Filesystem Paths', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should sanitize actual project directory paths', async () => {
            const actualPath = __dirname; // Real path from the test
            app.get('/test', (req, res) => {
                const err = new Error(`Failed to load ${actualPath}/config.json`);
                err.status = 500;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(500);
            // Should not contain the actual path
            expect(response.body.error).not.toContain(actualPath);
            expect(response.body.error).not.toContain('config.json');
            // Should return generic 500 message (from getGenericMessageForStatus)
            expect(response.body.error).toBe('サーバーエラーが発生しました。');
        });

        it('should sanitize actual __filename paths', async () => {
            const actualFile = __filename; // Real file path
            app.get('/test', (req, res) => {
                const err = new Error(`Cannot access ${actualFile}`);
                err.status = 418;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(418);
            const errorMessage = response.body.error;
            // Should contain [PATH] placeholder
            expect(errorMessage).toContain('[PATH]');
            // Should not contain any part of the actual path
            expect(errorMessage).not.toContain('errorHandler');
            expect(errorMessage).not.toContain('integration');
            expect(errorMessage).not.toContain('.test.js');
        });

        it('should sanitize paths in stack traces when status is provided', async () => {
            const actualPath = require('path').resolve(__dirname, '../../api/middleware/errorHandler.js');
            app.get('/test', (req, res) => {
                const err = new Error(`Module error at ${actualPath}`);
                err.status = 418;
                throw err;
            });
            app.use(errorHandler);

            const response = await request(app).get('/test');

            expect(response.status).toBe(418);
            expect(response.body.error).toContain('[PATH]');
            expect(response.body.error).not.toContain('errorHandler.js');
        });
    });
});
