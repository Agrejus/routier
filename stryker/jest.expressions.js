const config = require('../jest.stryker');

// Includes datastore tests deliberately. The parser is reached end-to-end through
// queryables, so datastore suites kill expressions mutants that no core/expressions test
// covers. Measured: scoping to core/src/expressions alone moved 22 mutants from "survived"
// to "no coverage" and lowered the score from 62.64% to 62.08%.
module.exports = config([
    '<rootDir>/core/src/expressions/**/*.test.ts',
    '<rootDir>/datastore/**/*.test.ts',
]);
