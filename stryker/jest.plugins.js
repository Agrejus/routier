const config = require('../jest.stryker');

// Not just the suites sitting beside the mutated code. Several files in this area are
// exercised only from other workspaces, and a mutant no test reaches counts against the
// score exactly like a survivor — see the scoping note in stryker.base.mjs.
module.exports = config([
    '<rootDir>/core/src/plugins/**/*.test.ts',
    // splitSendableOptions / serializeQueryOptions round-trips.
    '<rootDir>/core/src/expressions/serializeExpression.test.ts',
    // ConcurrencyDbPlugin: the datastore is the only caller that stacks it.
    '<rootDir>/datastore/src/collections/OptimisticConcurrency.test.ts',
    '<rootDir>/datastore/src/collections/wrapperStacking.test.ts',
    '<rootDir>/datastore/src/collections/databaseScoping.test.ts',
    // wire/: createRequestHandler and the persist/query serializers.
    '<rootDir>/plugins/replication/src/httpTransport.test.ts',
    '<rootDir>/plugins/replication/src/httpTransportSecurity.test.ts',
    // EphemeralDataPlugin and the tuple/data translators.
    '<rootDir>/plugins/memory/src/tests/keyLookup.test.ts',
    '<rootDir>/plugins/memory/src/tests/joins.test.ts',
]);
