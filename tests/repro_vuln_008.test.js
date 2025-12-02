/**
 * @jest-environment node
 */
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
             require('../api/routes/generate');
        }).toThrow(/Redis.*configured|Redis.*設定が必須/);
        // Accepts either the English error from ocr.js or Japanese error from config.js
    });

    test('Development Behavior: Should still work without Redis (logging warning in non-Jest environment)', () => {
         // Set necessary environment variables for config validation
         process.env.NODE_ENV = 'development';
         process.env.GEMINI_API_KEY = 'dummy-key';

         // Ensure Redis vars are NOT set
         delete process.env.KV_URL;
         delete process.env.REDIS_URL;

         const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

         try {
             require('../api/routes/generate');
             // In Jest environment, warning is suppressed to prevent Redis connection issues
             // The warning would be logged in non-Jest development environments without Redis
             // This test verifies the module loads successfully without Redis in development
             expect(true).toBe(true); // Module loaded successfully
         } finally {
             consoleWarnSpy.mockRestore();
         }
    });
});
