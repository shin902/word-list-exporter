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

    it('should log full error in development environment', () => {
        process.env.NODE_ENV = 'development';
        const err = new Error('Test development error');
        err.status = 400;

        errorHandler(err, req, res, next);

        expect(consoleSpy).toHaveBeenCalledWith('Error:', err);
    });

    it('should log sanitized structured error in production environment', () => {
        process.env.NODE_ENV = 'production';
        const err = new Error('Test production error with path /home/user/project/secret.txt');
        err.status = 500;

        errorHandler(err, req, res, next);

        expect(consoleSpy).toHaveBeenCalledWith(
            'Error occurred:',
            expect.objectContaining({
                message: expect.stringMatching(/Test production error with path \[PATH\]/),
                status: 500,
                timestamp: expect.any(String),
                errorId: expect.any(String)
            })
        );

        // Check if path is replaced
        const loggedObj = consoleSpy.mock.calls[0][1];
        expect(loggedObj.message).not.toContain('/home/user/project/secret.txt');
    });

    it('should default to safe logging if NODE_ENV is undefined', () => {
        delete process.env.NODE_ENV;
        const err = new Error('Test undefined env error');

        errorHandler(err, req, res, next);

        expect(consoleSpy).toHaveBeenCalledWith(
            'Error occurred:',
            expect.anything()
        );
    });

    it('should handle Gemini API 429 error', () => {
        const err = new Error('Gemini API error 429');

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith({
            error: 'APIのリクエスト上限に達しました。しばらくしてから再試行してください。'
        });
    });

    it('should handle Gemini API 401/403 error', () => {
        const err = new Error('Gemini API error 401');

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'サーバーの設定エラーです。管理者に連絡してください。'
        });
    });

    it('should handle standard status errors', () => {
        const err = new Error('Bad Request');
        err.status = 400;

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Bad Request'
        });
    });

    it('should default to 500 for unknown errors', () => {
        const err = new Error('Unknown');

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
        });
    });
});
