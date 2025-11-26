// jest.config.jsdom.js
module.exports = {
    displayName: 'jsdom',
    testEnvironment: 'jsdom',
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/migration.test.js'
    ],
    testPathIgnorePatterns: [
        "/node_modules/",
        "/tests/unit/dos-protection.test.js"
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    collectCoverageFrom: [
        'public/app.js',
        '!**/node_modules/**'
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    }
};
