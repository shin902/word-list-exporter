
const request = require('supertest');
const express = require('express');

describe('VULN-008 Reproduction: Rate Limit Bypass in Serverless', () => {
    let originalEnv;

    beforeEach(() => {
        jest.resetModules();
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test('Fixed Behavior: Should THROW ERROR without Redis in production', () => {
        // Set necessary environment variables for config validation
        process.env.NODE_ENV = 'production';
        process.env.GEMINI_API_KEY = 'dummy-key';
        process.env.FRONTEND_URL = 'https://example.com';

        // Ensure Redis vars are NOT set
        delete process.env.KV_URL;
        delete process.env.REDIS_URL;

        expect(() => {
             require('../api/routes/ocr');
        }).toThrow(/Redis.*configured|Redis.*設定が必須/);
        // Accepts either the English error from ocr.js or Japanese error from config.js
    });

    test('Development Behavior: Should still work without Redis (logging warning)', () => {
         // Set necessary environment variables for config validation
         process.env.NODE_ENV = 'development';
         process.env.GEMINI_API_KEY = 'dummy-key';

         // Ensure Redis vars are NOT set
         delete process.env.KV_URL;
         delete process.env.REDIS_URL;

         const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

         try {
             require('../api/routes/ocr');
             expect(consoleWarnSpy).toHaveBeenCalledWith(
                 expect.stringContaining('WARNING: Redis is not configured')
             );
         } finally {
             consoleWarnSpy.mockRestore();
         }
    });
});
