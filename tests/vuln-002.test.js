/**
 * @jest-environment node
 */
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

    // 0.5MB raw -> ~0.67MB base64 (Under 1MB limit)
    it('should accept 0.5MB raw payload (under 1MB limit)', async () => {
        const payload = generateLargeString(0.5 * 1024 * 1024);
        const base64Payload = Buffer.from(payload).toString('base64');

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/png;base64,${base64Payload}` });

        // Should be success since we mocked OCR and size is okay
        expect(res.status).toBe(200);
    });

    // 1.5MB raw -> ~2MB base64 (Over 1MB limit)
    it('should reject 1.5MB raw payload (over 1MB limit)', async () => {
        const payload = generateLargeString(1.5 * 1024 * 1024);
        const base64Payload = Buffer.from(payload).toString('base64');

        const res = await request(app)
            .post('/api/ocr')
            .send({ image: `data:image/png;base64,${base64Payload}` });

        // Now should be rejected with 413
        expect(res.status).toBe(413);
    });
});
