/**
 * @jest-environment node
 */
const request = require('supertest');
const app = require('../../api/index');

describe('Trust Proxy Integration Test', () => {
    // このテストスイート専用のExpressインスタンスにルートを追加
    // これにより、他のテストに影響を与えずに、req.ipの値を直接テストできる
    app.get('/__test_ip', (req, res) => {
        res.status(200).send(req.ip);
    });

    it('should return the client IP from X-Forwarded-For header', async () => {
        const clientIp = '192.168.10.1';
        const proxyIp = '10.0.0.1';

        const response = await request(app)
            .get('/__test_ip')
            .set('X-Forwarded-For', `${clientIp}, ${proxyIp}`);

        expect(response.text).toBe(clientIp);
    });

    it('should return the socket remote address when X-Forwarded-For is not present', async () => {
        const response = await request(app)
            .get('/__test_ip');

        // supertestはlocalhostからリクエストを送るので、IPv6のループバックアドレスが返される
        expect(response.text).toBe('::ffff:127.0.0.1');
    });
});
