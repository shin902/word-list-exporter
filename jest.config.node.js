// jest.config.node.js
module.exports = {
    displayName: 'node',
    testEnvironment: 'node',
    testMatch: [
        '**/api/__tests__/**/*.test.js',
        '**/tests/integration/**/*.test.js',
        '**/tests/repro_vuln_*.test.js',
        '**/tests/vuln-*.test.js',
        '!**/tests/integration/migration.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup-node.js'],
};
