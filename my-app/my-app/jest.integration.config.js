module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 60000,
  maxWorkers: 1, // Run integration tests sequentially
  collectCoverage: false, // Skip coverage for integration tests
  globalSetup: '<rootDir>/tests/integrationSetup.js',
  globalTeardown: '<rootDir>/tests/integrationTeardown.js'
};