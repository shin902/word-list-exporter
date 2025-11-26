// jest.config.jsdom.js
module.exports = {
    displayName: 'jsdom',
    testEnvironment: 'jsdom',
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/migration.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
