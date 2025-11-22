const errorHandler = require('../../api/middleware/errorHandler');

describe('Error Handler Middleware', () => {
    let req, res, next;
    let originalConsoleError;
    let consoleSpy;
    let originalEnv;

    beforeAll(() => {
        originalConsoleError = console.error;
        originalEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
        console.error = originalConsoleError;
        process.env.NODE_ENV = originalEnv;
    });

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        consoleSpy = jest.fn();
        console.error = consoleSpy;
    });

    describe('Development Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        it('should log full error object', () => {
            const err = new Error('Test dev error');
            errorHandler(err, req, res, next);
            expect(consoleSpy).toHaveBeenCalledWith('Error:', err);
        });

        it('should return raw error message to client', () => {
            const err = new Error('Specific dev error');
            err.status = 400;
            errorHandler(err, req, res, next);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Specific dev error'
            }));

            const responseBody = res.json.mock.calls[0][0];
            expect(responseBody.errorId).toBeUndefined();
        });
    });

    describe('Production Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should log sanitized structured error', () => {
            const err = new Error('Error in /home/user/secret.txt');
            errorHandler(err, req, res, next);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Error occurred:',
                expect.objectContaining({
                    message: expect.stringContaining('[PATH]'),
                    message: expect.not.stringContaining('/home/user/secret.txt'),
                    errorId: expect.any(String)
                })
            );
        });

        it('should return sanitized message to client for status errors', () => {
            const err = new Error('Invalid input from /var/www/config.json');
            err.status = 400;

            errorHandler(err, req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: expect.stringContaining('[PATH]'),
                errorId: expect.any(String)
            }));

            const responseBody = res.json.mock.calls[0][0];
            expect(responseBody.error).not.toContain('/var/www/config.json');
        });

        it('should return generic message for 500 errors', () => {
            const err = new Error('Database connection failed to 192.168.1.1');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。',
                errorId: expect.any(String)
            }));
        });

        describe('Path Sanitization', () => {
            it('should sanitize Unix paths with spaces', () => {
                const err = new Error('File not found: /usr/local/My Folder/app.log');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toContain('[PATH]');
                expect(responseBody.error).not.toContain('/usr/local');
            });

            it('should sanitize Windows paths with spaces', () => {
                const err = new Error('Access denied to C:\\Program Files\\MyApp\\secret.key');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toContain('[PATH]');
                expect(responseBody.error).not.toContain('secret.key');
            });

            it('should NOT sanitize non-path strings like 5/10', () => {
                const err = new Error('Rate limit: 5/10 requests');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('Rate limit: 5/10 requests');
            });

            it('should sanitize deep Unix paths', () => {
                const err = new Error('Error at /app/src/controllers/user.js');
                err.status = 400;
                errorHandler(err, req, res, next);
                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toContain('[PATH]');
            });
        });

        describe('Gemini API Handling', () => {
            it('should return Japanese rate limit message for Gemini 429 errors', () => {
                const err = new Error('Gemini API error: 429 rate limit exceeded');
                errorHandler(err, req, res, next);

                expect(res.status).toHaveBeenCalledWith(429);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。',
                    errorId: expect.any(String)
                }));
            });

            it('should return Japanese server error message for Gemini 401/403 errors', () => {
                const err = new Error('Gemini API error: 403 forbidden');
                errorHandler(err, req, res, next);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'サーバーの設定エラーです。管理者に連絡してください。',
                    errorId: expect.any(String)
                }));
            });
        });

        describe('Edge Cases', () => {
            it('should handle null error object', () => {
                const err = null;
                errorHandler(err, req, res, next);

                expect(res.status).toHaveBeenCalledWith(500);
                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
            });

            it('should truncate very long error messages with ellipsis', () => {
                const longMsg = 'A'.repeat(300);
                const err = new Error(longMsg);
                err.status = 400;

                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error.length).toBeLessThanOrEqual(200);
                expect(responseBody.error.endsWith('...')).toBe(true);
            });
        });
    });
});
