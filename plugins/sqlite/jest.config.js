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
        '^@routier/core$': '<rootDir>/../../core/src/index.ts',
        '^@routier/core/(.*)$': '<rootDir>/../../core/src/$1',
        '^@routier/datastore$': '<rootDir>/../../datastore/src/index.ts',
        '^@routier/datastore/(.*)$': '<rootDir>/../../datastore/src/$1',
        '^@routier/sql-plugin-core$': '<rootDir>/../../plugins/sql-core/src/index.ts',
        '^@routier/test-utils$': '<rootDir>/../../test-utils/src/index.ts',
        // Faker ships both builds, and jest picks the wrong one. `jest-environment-node` resolves
        // `exports` with the condition `node`, faker's map has no `node` key, so it falls through
        // to `default` — the ESM build — which ts-jest cannot parse and the suite dies at import.
        // Naming the CJS build the package already publishes is enough; no transform needed.
        '^@faker-js/faker$': '<rootDir>/../../node_modules/@faker-js/faker/dist/index.cjs'
    }
};
