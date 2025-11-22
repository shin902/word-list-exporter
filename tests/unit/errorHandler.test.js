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

            // In dev, errorId is set to undefined, so the key exists but value is undefined.
            // We check that it is undefined.
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
            // No status, implies 500

            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。',
                errorId: expect.any(String)
            }));

            // Ensure internal details are NOT in the client response
            const responseBody = res.json.mock.calls[0][0];
            expect(responseBody.error).not.toContain('Database');
        });

        describe('Path Sanitization', () => {
            it('should sanitize Unix paths', () => {
                const err = new Error('File not found: /usr/local/bin/app');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('File not found: [PATH]');
            });

            it('should sanitize Windows paths (Drive letter)', () => {
                const err = new Error('Access denied to C:\\Users\\Admin\\secret.key');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('Access denied to [PATH]');
            });

            it('should sanitize Windows paths (UNC)', () => {
                const err = new Error('Network share \\\\server\\share\\folder failed');
                err.status = 400;
                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('Network share [PATH] failed');
            });
        });

        describe('Truncation', () => {
            it('should truncate long error messages', () => {
                const longMsg = 'A'.repeat(300);
                const err = new Error(longMsg);
                err.status = 400;

                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error.length).toBeLessThanOrEqual(200);
            });
        });

        describe('Edge Cases', () => {
            it('should handle undefined NODE_ENV as production (safe default)', () => {
                delete process.env.NODE_ENV;
                const err = new Error('Secret /path');
                err.status = 400;

                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).not.toContain('/path');
                expect(responseBody).toHaveProperty('errorId');
            });

            it('should handle null/undefined error message', () => {
                const err = { status: 400 }; // No message property

                errorHandler(err, req, res, next);

                const responseBody = res.json.mock.calls[0][0];
                expect(responseBody.error).toBe('Unknown error');
            });
        });
    });
});
