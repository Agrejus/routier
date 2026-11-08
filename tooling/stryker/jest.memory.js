const config = require('../../jest.stryker');

module.exports = config([
    '<rootDir>/plugins/memory/src/tests/memoryPlugin.test.ts',
    '<rootDir>/plugins/memory/src/tests/keyLookup.test.ts',
    '<rootDir>/plugins/memory/src/tests/joins.test.ts',
]);
