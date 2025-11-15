/**
 * Unit tests for validation functions
 * Run these tests using a test framework like Jest or Mocha
 */

// Test helper to load app.js functions
// In a real test environment, you would import or require the functions
// For now, these are example test structures

describe('validateApiKey', () => {
    test('accepts valid AIza format (39 characters)', () => {
        const validKey = 'AIza' + 'x'.repeat(35);
        expect(validateApiKey(validKey)).toBe(true);
    });

    test('rejects AIza format with wrong length', () => {
        const shortKey = 'AIza' + 'x'.repeat(20);
        const longKey = 'AIza' + 'x'.repeat(50);
        expect(validateApiKey(shortKey)).toBe(false);
        expect(validateApiKey(longKey)).toBe(false);
    });

    test('accepts valid non-AIza format (20-100 chars)', () => {
        const validKey = 'a'.repeat(20);
        expect(validateApiKey(validKey)).toBe(true);
    });

    test('rejects short keys', () => {
        const shortKey = 'short';
        expect(validateApiKey(shortKey)).toBe(false);
    });

    test('rejects empty or null keys', () => {
        expect(validateApiKey('')).toBe(false);
        expect(validateApiKey(null)).toBe(false);
        expect(validateApiKey(undefined)).toBe(false);
    });

    test('rejects keys with invalid characters', () => {
        const invalidKey1 = 'a'.repeat(20) + '!@#$';
        const invalidKey2 = 'a'.repeat(20) + '日本語';
        const invalidKey3 = 'a'.repeat(20) + ' ';
        expect(validateApiKey(invalidKey1)).toBe(false);
        expect(validateApiKey(invalidKey2)).toBe(false);
        expect(validateApiKey(invalidKey3)).toBe(false);
    });

    test('accepts keys with hyphens and underscores', () => {
        const validKey1 = 'a-b-c-d-e-f-g-h-i-j-k';
        const validKey2 = 'a_b_c_d_e_f_g_h_i_j_k';
        expect(validateApiKey(validKey1)).toBe(true);
        expect(validateApiKey(validKey2)).toBe(true);
    });

    test('rejects keys longer than 100 characters', () => {
        const longKey = 'a'.repeat(101);
        expect(validateApiKey(longKey)).toBe(false);
    });
});

describe('sanitizeInput', () => {
    test('removes control characters', () => {
        const input = 'hello\x00\x01\x02world';
        const expected = 'helloworld';
        expect(sanitizeInput(input)).toBe(expected);
    });

    test('trims whitespace', () => {
        const input = '  hello world  ';
        const expected = 'hello world';
        expect(sanitizeInput(input)).toBe(expected);
    });

    test('respects max length', () => {
        const input = 'a'.repeat(2000);
        const result = sanitizeInput(input, 100);
        expect(result.length).toBe(100);
    });

    test('returns empty string for null/undefined', () => {
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
        expect(sanitizeInput('')).toBe('');
    });

    test('handles Japanese characters', () => {
        const input = '  こんにちは世界  ';
        const expected = 'こんにちは世界';
        expect(sanitizeInput(input)).toBe(expected);
    });

    test('removes DEL character (0x7F)', () => {
        const input = 'hello\x7Fworld';
        const expected = 'helloworld';
        expect(sanitizeInput(input)).toBe(expected);
    });
});

describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
        const input = '<script>alert("XSS")</script>';
        const result = escapeHtml(input);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
    });

    test('escapes quotes', () => {
        const input = '"double" and \'single\'';
        const result = escapeHtml(input);
        expect(result).toContain('&quot;');
    });

    test('escapes ampersands', () => {
        const input = 'Tom & Jerry';
        const result = escapeHtml(input);
        expect(result).toContain('&amp;');
    });

    test('handles empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('handles plain text without changes', () => {
        const input = 'Hello World';
        expect(escapeHtml(input)).toBe('Hello World');
    });
});

describe('generateUniqueId', () => {
    test('generates non-empty string', () => {
        const id = generateUniqueId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('generates unique IDs', () => {
        const id1 = generateUniqueId();
        const id2 = generateUniqueId();
        expect(id1).not.toBe(id2);
    });

    test('generates IDs in rapid succession without collision', () => {
        const ids = new Set();
        for (let i = 0; i < 1000; i++) {
            ids.add(generateUniqueId());
        }
        // All IDs should be unique
        expect(ids.size).toBe(1000);
    });
});

describe('parseSubscriptSuperscript', () => {
    test('converts superscript with braces', () => {
        const input = 'x^{2}';
        const result = parseSubscriptSuperscript(input);
        expect(result).toContain('<span class="superscript">2</span>');
    });

    test('converts single character superscript', () => {
        const input = 'x^2';
        const result = parseSubscriptSuperscript(input);
        expect(result).toContain('<span class="superscript">2</span>');
    });

    test('converts subscript with braces', () => {
        const input = 'H_{2}O';
        const result = parseSubscriptSuperscript(input);
        expect(result).toContain('<span class="subscript">2</span>');
    });

    test('converts single character subscript', () => {
        const input = 'H_2O';
        const result = parseSubscriptSuperscript(input);
        expect(result).toContain('<span class="subscript">2</span>');
    });

    test('escapes HTML before conversion (XSS prevention)', () => {
        const input = '<script>alert("XSS")</script>^2';
        const result = parseSubscriptSuperscript(input);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    test('handles multiple superscripts and subscripts', () => {
        const input = 'x^2 + y^3 + H_2O';
        const result = parseSubscriptSuperscript(input);
        expect(result).toContain('<span class="superscript">2</span>');
        expect(result).toContain('<span class="superscript">3</span>');
        expect(result).toContain('<span class="subscript">2</span>');
    });
});

describe('debounce', () => {
    jest.useFakeTimers();

    test('delays function execution', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(300);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('cancels previous calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        jest.advanceTimersByTime(300);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('preserves function arguments', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 300);

        debouncedFn('arg1', 'arg2');
        jest.advanceTimersByTime(300);

        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    jest.useRealTimers();
});
