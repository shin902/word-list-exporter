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
        jest.clearAllMocks(); // Restore this to reset mocks between tests
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
});
