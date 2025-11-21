const request = require('supertest');
const app = require('../api/index');

// Mock the Gemini API utils
jest.mock('../api/utils/gemini', () => ({
    performOCR: jest.fn().mockResolvedValue('Mocked OCR Result')
}));

describe('Vuln-002: Large Payload DoS', () => {
    // Increase timeout for large payload tests
    jest.setTimeout(30000);

    const generateLargeString = (sizeInBytes) => {
        return 'a'.repeat(sizeInBytes);
    };

    // 3MB raw -> ~4MB base64 (Under 5MB limit)
    it('should accept 3MB raw payload (under 5MB limit)', async () => {
        const payload = generateLargeString(3 * 1024 * 1024);
        const base64Payload = Buffer.from(payload).toString('base64');

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/png;base64,${base64Payload}` });

        // Should be success since we mocked OCR and size is okay
        expect(res.status).toBe(200);
    });

    // 6MB raw -> ~8MB base64 (Over 5MB limit)
    it('should reject 6MB raw payload (over 5MB limit)', async () => {
        const payload = generateLargeString(6 * 1024 * 1024);
        const base64Payload = Buffer.from(payload).toString('base64');

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/png;base64,${base64Payload}` });

        // Now should be rejected with 413
        expect(res.status).toBe(413);
    });
});
