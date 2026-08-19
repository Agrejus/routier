const config = require('../jest.stryker');

module.exports = config([
    '<rootDir>/plugins/otel/src/**/*.test.ts',
]);
