const config = require('../jest.stryker');

module.exports = config([
    '<rootDir>/core/src/pipeline/**/*.test.ts',
    '<rootDir>/core/src/collections/**/*.test.ts',
]);
