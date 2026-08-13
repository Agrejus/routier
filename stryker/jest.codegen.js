const config = require('../jest.stryker');

module.exports = config([
    '<rootDir>/core/src/codegen/**/*.test.ts',
    '<rootDir>/core/src/schema/**/*.test.ts',
]);
