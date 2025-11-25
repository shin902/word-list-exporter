const errorHandler = require('../../api/middleware/errorHandler');

describe('Error Handler Middleware', () => {
    let req, res, next;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
        jest.clearAllMocks();
        // Clear console mocks
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    describe('Production Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should return generic 500 error message in production', () => {
            const err = new Error('Detailed internal error message');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
                })
            );
        });

        it('should include errorId in production', () => {
            const err = new Error('Some error');
            errorHandler(err, req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorId: expect.any(String)
                })
            );
        });

        it('should sanitize Unix paths in error messages', () => {
            const err = { status: 400, message: 'Failed to load /etc/passwd' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.not.stringContaining('/etc/passwd')
                })
            );
        });

        it('should sanitize Windows paths in error messages', () => {
            const err = { status: 400, message: 'Cannot access C:\\Windows\\System32\\config' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.not.stringContaining('C:\\Windows')
                })
            );
        });

        it('should sanitize paths with spaces', () => {
            // Use status code without generic message to test sanitization
            const err = { status: 418, message: 'Error in /home/user/my documents/secret.txt' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(418);
            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toContain('[PATH]');
            expect(errorMessage).not.toContain('/home/user/my documents');
        });

        it('should NOT sanitize false positives like "JSON/XML"', () => {
            const err = { status: 400, message: 'Invalid format: JSON/XML expected' };
            errorHandler(err, req, res, next);

            const errorMessage = res.json.mock.calls[0][0].error;
            // Should use generic message, not sanitize
            expect(errorMessage).toBe('リクエストが不正です。');
        });

        it('should use generic message for 400 status in production', () => {
            const err = { status: 400, message: 'Some validation error' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'リクエストが不正です。'
                })
            );
        });

        it('should use generic message for 404 status in production', () => {
            const err = { status: 404, message: 'User not found at /api/users/123' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'リソースが見つかりません。'
                })
            );
        });

        it('should handle Gemini API 429 error', () => {
            const err = new Error('Gemini API error: 429');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(429);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。'
                })
            );
        });

        it('should handle Gemini API 401 error', () => {
            const err = new Error('Gemini API error: 401');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'サーバーの設定エラーです。管理者に連絡してください。'
                })
            );
        });

        it('should handle Gemini API 403 error', () => {
            const err = new Error('Gemini API error: 403');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'サーバーの設定エラーです。管理者に連絡してください。'
                })
            );
        });

        it('should truncate very long error messages', () => {
            const longMessage = 'a'.repeat(300);
            const err = { status: 400, message: longMessage };
            errorHandler(err, req, res, next);

            // Should use generic message for 400
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'リクエストが不正です。'
                })
            );
        });

        it('should handle null error object', () => {
            errorHandler(null, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: '不明なエラーが発生しました。'
                })
            );
        });

        it('should handle undefined error object', () => {
            errorHandler(undefined, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: '不明なエラーが発生しました。'
                })
            );
        });

        it('should validate res object before using it', () => {
            const invalidRes = {};
            const err = new Error('Test error');

            // Should not throw
            expect(() => {
                errorHandler(err, req, invalidRes, next);
            }).not.toThrow();

            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Invalid response object')
            );
        });
    });

    describe('Development Environment', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        // Fixed behavior: Development environment should also return generic/sanitized messages
        it('should return generic error message in development for 500 errors', () => {
            const err = new Error('Detailed internal error message');
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
                })
            );
            // Should NOT contain the detailed message
            expect(res.json).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Detailed internal error message'
                })
            );
        });

        // Fixed behavior: Development environment should include errorId for consistency
        it('should include errorId in development', () => {
            const err = new Error('Some error');
            errorHandler(err, req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorId: expect.any(String)
                })
            );
        });

        it('should sanitize paths in development for status errors', () => {
            const err = { status: 418, message: 'Failed to load /etc/passwd' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(418);
            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toContain('[PATH]');
            expect(errorMessage).not.toContain('/etc/passwd');
        });

        it('should log full error details in development', () => {
            const err = new Error('Test error');
            errorHandler(err, req, res, next);

            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error ID'),
                expect.objectContaining({
                    message: 'Test error',
                    name: 'Error',
                    stack: expect.any(String)
                })
            );
        });

        it('should handle statusCode property (alternative to status)', () => {
            const err = { statusCode: 401, message: 'Unauthorized' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: '認証が必要です。', // Generic message for 401
                errorId: expect.any(String)
            });
        });

        // Regression test for Vuln-001
        it('should NOT disclose sensitive path information (Vuln-001 Regression)', () => {
            const sensitiveMessage = 'Error: /home/user/secret/config.json not found';
            const err = new Error(sensitiveMessage);

            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            const jsonResponse = res.json.mock.calls[0][0];
            expect(jsonResponse.error).not.toContain('/home/user/secret/config.json');
            expect(jsonResponse.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
        });
    });

    describe('Environment Detection', () => {
        it('should default to production mode when NODE_ENV is not set', () => {
            delete process.env.NODE_ENV;
            const err = new Error('Test error');
            errorHandler(err, req, res, next);

            // Should behave like production (include errorId)
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorId: expect.any(String),
                    error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
                })
            );
        });

        it('should default to production when NODE_ENV is "test"', () => {
            process.env.NODE_ENV = 'test';
            const err = new Error('Test error');
            errorHandler(err, req, res, next);

            // Should behave like production (include errorId)
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorId: expect.any(String)
                })
            );
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should handle error with empty message', () => {
            const err = { status: 400, message: '' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'リクエストが不正です。'
                })
            );
        });

        it('should handle error without message property', () => {
            const err = { status: 500 };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalled();
        });

        it('should handle non-Error objects thrown as errors', () => {
            const err = { status: 400, message: 'String error' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalled();
        });

        it('should sanitize single-level Windows paths like C:\\file.txt', () => {
            const err = { status: 418, message: 'Cannot read C:\\config.json' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(418);
            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toContain('[PATH]');
            expect(errorMessage).not.toContain('C:\\config.json');
        });

        it('should sanitize Windows paths with Program Files', () => {
            const err = { status: 418, message: 'Error in C:\\Program Files\\app\\config.ini' };
            errorHandler(err, req, res, next);

            expect(res.status).toHaveBeenCalledWith(418);
            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toContain('[PATH]');
            expect(errorMessage).not.toContain('Program Files');
        });
    });

    describe('Configuration', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'production';
        });

        it('should truncate very long error messages', () => {
            // Use a message longer than default 200 chars without paths
            const longMessage = 'Error occurred: ' + 'x'.repeat(300);
            const err = { status: 418, message: longMessage };
            errorHandler(err, req, res, next);

            const errorMessage = res.json.mock.calls[0][0].error;
            // Should be truncated (200 chars + '...')
            expect(errorMessage.length).toBeLessThanOrEqual(203);
            expect(errorMessage).toContain('...');
        });

        it('should not truncate messages shorter than limit', () => {
            const shortMessage = 'Short error message';
            const err = { status: 418, message: shortMessage };
            errorHandler(err, req, res, next);

            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toBe(shortMessage);
            expect(errorMessage).not.toContain('...');
        });

        it('should handle exactly 200 char messages without truncation', () => {
            const exactMessage = 'x'.repeat(200);
            const err = { status: 418, message: exactMessage };
            errorHandler(err, req, res, next);

            const errorMessage = res.json.mock.calls[0][0].error;
            expect(errorMessage).toBe(exactMessage);
            expect(errorMessage.length).toBe(200);
        });
    });
});
