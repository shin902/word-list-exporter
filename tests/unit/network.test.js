const { getClientIp } = require('../../api/utils/network');

describe('Network Utils', () => {
    describe('getClientIp', () => {
        it('should return req.ip when it exists', () => {
            const req = {
                ip: '127.0.0.1',
                headers: {
                    'x-forwarded-for': '1.2.3.4, 5.6.7.8'
                }
            };
            expect(getClientIp(req)).toBe('127.0.0.1');
        });

        it('should return "unknown" when req.ip is not available', () => {
            const req = {
                headers: {
                    'x-forwarded-for': '1.2.3.4, 5.6.7.8'
                }
            };
            expect(getClientIp(req)).toBe('unknown');
        });

        it('should handle ipv6 addresses from req.ip', () => {
            const req = {
                ip: '::ffff:127.0.0.1',
                headers: {
                    'x-forwarded-for': '1.2.3.4'
                }
            };
            expect(getClientIp(req)).toBe('::ffff:127.0.0.1');
        });

        it('should return "unknown" for empty string req.ip', () => {
            const req = { ip: ' ' };
            expect(getClientIp(req)).toBe('unknown');
        });

        it('should return "unknown" for null req.ip', () => {
            const req = { ip: null };
            expect(getClientIp(req)).toBe('unknown');
        });

        it('should return "unknown" for undefined req object', () => {
            const req = {};
            expect(getClientIp(req)).toBe('unknown');
        });
    });
});
