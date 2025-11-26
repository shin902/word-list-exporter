/**
 * @jest-environment node
 */
const errorHandler = require('../../api/middleware/errorHandler');

describe('Error Handler Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should return a generic message for detailed errors', () => {
        const err = new Error('Internal server error');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
        }));
    });

    it('should handle Gemini API auth errors with a specific message', () => {
        const err401 = new Error('Gemini API error: 401');
        const res401 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        errorHandler(err401, req, res401, next);
        expect(res401.status).toHaveBeenCalledWith(500);
        expect(res401.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'サーバーの設定エラーです。管理者に連絡してください。'
        }));

        const err403 = new Error('Gemini API error: 403');
        const res403 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        errorHandler(err403, req, res403, next);
        expect(res403.status).toHaveBeenCalledWith(500);
        expect(res403.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'サーバーの設定エラーです。管理者に連絡してください。'
        }));
    });

    it('should handle null or undefined error object', () => {
        errorHandler(null, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: '不明なエラーが発生しました。'
        }));
    });

    it('should handle an error with status 429', () => {
        const err = new Error('Too many requests');
        err.status = 429;
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'リクエストが多すぎます。しばらくしてから再試行してください。'
        }));
    });

    it('should handle various other HTTP status codes', () => {
        const statusMessages = {
            401: '認証が必要です。',
            403: 'アクセスが拒否されました。',
            404: 'リソースが見つかりません。',
            502: 'ゲートウェイエラーが発生しました。',
            503: 'サービスが一時的に利用できません。'
        };

        Object.entries(statusMessages).forEach(([code, message]) => {
            const err = new Error(`HTTP error ${code}`);
            err.status = Number(code);
            const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            errorHandler(err, req, mockRes, next);
            expect(mockRes.status).toHaveBeenCalledWith(Number(code));
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                error: message
            }));
        });
    });
});
