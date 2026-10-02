const config = require('../../jest.stryker');

module.exports = config([
    '<rootDir>/datastore/src/inspection/**/*.test.ts',
    '<rootDir>/datastore/src/queryable/explain.test.ts',
]);
