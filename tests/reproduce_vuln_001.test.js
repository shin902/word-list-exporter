const errorHandler = require('../api/middleware/errorHandler');

describe('Vuln-001: Error Handler Information Disclosure', () => {
    let req;
    let res;
    let next;
    let originalEnv;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        originalEnv = process.env.NODE_ENV;
        // Mock console.error to suppress output during tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.restoreAllMocks();
    });

    test('should NOT disclose detailed error in production', () => {
        process.env.NODE_ENV = 'production';
        const sensitiveMessage = 'Error: /home/user/secret/config.json not found';
        const err = new Error(sensitiveMessage);

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        // Should return generic message
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'サーバーエラーが発生しました。しばらくしてから再試行してください。'
        }));
        // Production should include errorId
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            errorId: expect.any(String)
        }));
    });

    test('should NOT disclose detailed error in development (after fix)', () => {
         process.env.NODE_ENV = 'development';
         const sensitiveMessage = 'Error: /home/user/secret/config.json not found';
         const err = new Error(sensitiveMessage);

         errorHandler(err, req, res, next);

         expect(res.status).toHaveBeenCalledWith(500);
         // Expectation for fix: should NOT contain sensitive path
         const jsonResponse = res.json.mock.calls[0][0];
         expect(jsonResponse.error).not.toContain('/home/user/secret/config.json');
         expect(jsonResponse.error).toBe('サーバーエラーが発生しました。しばらくしてから再試行してください。');
     });
});
