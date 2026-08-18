module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/'],
  verbose: true,
  setupFiles: ['<rootDir>/tests/setup/env.js']
};
