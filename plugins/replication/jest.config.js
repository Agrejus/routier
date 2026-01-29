const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@routier/core$': path.resolve(__dirname, '../../core/src/index.ts'),
    '^@routier/core/(.*)$': path.resolve(__dirname, '../../core/src/$1'),
    '^@routier/datastore$': path.resolve(__dirname, '../../datastore/src/index.ts'),
    '^@routier/datastore/(.*)$': path.resolve(__dirname, '../../datastore/src/$1'),
    '^@routier/test-utils$': path.resolve(__dirname, '../../test-utils/src/index.ts')
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|tinybench|@routier)/)'
  ],
  setupFiles: ['<rootDir>/../../test.setup.js']
};
