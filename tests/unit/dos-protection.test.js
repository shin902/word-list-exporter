/**
 * @jest-environment node
 */

const ocr = require('../../api/routes/ocr.js');

// Mock console.warn to prevent logs from cluttering test output
let consoleWarnSpy;

beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    consoleWarnSpy.mockRestore();
});

describe('DoS Protection via failedValidationCounter', () => {
    // Expose internal state for testing. In a real app, you might use dependency injection.
    const { trackFailedValidation, failedValidationCounter, MAX_COUNTER_ENTRIES, FAILED_VALIDATION_THRESHOLD, clearTimer } = ocr;

    beforeEach(() => {
        failedValidationCounter.clear();
    });

    afterAll(() => {
        // Clean up the timer to prevent Jest from hanging
        if (typeof clearTimer === 'function') {
            clearTimer();
        }
    });

    it('should not grow the failedValidationCounter map beyond MAX_COUNTER_ENTRIES', () => {
        // Add entries up to the limit
        for (let i = 0; i < MAX_COUNTER_ENTRIES; i++) {
            trackFailedValidation(`192.168.0.${i}`);
        }
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);

        // Add one more entry, which should trigger the eviction
        trackFailedValidation('192.168.1.1');

        // The size should still be MAX_COUNTER_ENTRIES
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);

        // The first entry should have been evicted
        expect(failedValidationCounter.has('192.168.0.0')).toBe(false);

        // The new entry should exist
        expect(failedValidationCounter.has('192.168.1.1')).toBe(true);
    });

    it('should increment the count for an existing IP without evicting', () => {
        for (let i = 0; i < MAX_COUNTER_ENTRIES; i++) {
            trackFailedValidation(`192.168.0.${i}`);
        }
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);

        trackFailedValidation('192.168.0.0');
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);
        expect(failedValidationCounter.get('192.168.0.0')).toBe(2);
    });

    it('should evict the least recently used entry', () => {
        for (let i = 0; i < MAX_COUNTER_ENTRIES; i++) {
            trackFailedValidation(`192.168.0.${i}`);
        }
        // Access the first IP to make it recently used
        trackFailedValidation('192.168.0.0');

        // Add a new IP, which should evict the second IP (192.168.0.1)
        trackFailedValidation('192.168.1.1');

        expect(failedValidationCounter.has('192.168.0.0')).toBe(true);
        expect(failedValidationCounter.has('192.168.0.1')).toBe(false);
        expect(failedValidationCounter.has('192.168.1.1')).toBe(true);
    });

    it('should log warning when IP reaches threshold after eviction', () => {
        for (let i = 0; i < MAX_COUNTER_ENTRIES; i++) {
            trackFailedValidation(`192.168.0.${i}`);
        }

        const newIp = '10.0.0.1';
        for (let i = 0; i < FAILED_VALIDATION_THRESHOLD; i++) {
            trackFailedValidation(newIp);
        }

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining(`Possible DoS attack detected from IP: ${newIp}`)
        );
    });

    it('should allow adding an entry when at limit-1', () => {
        for (let i = 0; i < MAX_COUNTER_ENTRIES - 1; i++) {
            trackFailedValidation(`192.168.0.${i}`);
        }

        trackFailedValidation('10.0.0.1');
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);
        expect(failedValidationCounter.has('192.168.0.0')).toBe(true);
        expect(failedValidationCounter.has('10.0.0.1')).toBe(true);
    });

    it('should handle rapid addition of many entries beyond limit', () => {
        for (let i = 0; i < MAX_COUNTER_ENTRIES + 100; i++) {
            trackFailedValidation(`10.0.${Math.floor(i / 256)}.${i % 256}`);
        }
        expect(failedValidationCounter.size).toBe(MAX_COUNTER_ENTRIES);
    });
});
