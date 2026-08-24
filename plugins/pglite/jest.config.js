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
    testTimeout: 30000,
    moduleNameMapper: {
        '^@routier/core$': '<rootDir>/../../core/src/index.ts',
        '^@routier/core/(.*)$': '<rootDir>/../../core/src/$1',
        '^@routier/datastore$': '<rootDir>/../../datastore/src/index.ts',
        '^@routier/datastore/(.*)$': '<rootDir>/../../datastore/src/$1',
        '^@routier/sql-plugin-core$': '<rootDir>/../sql-core/src/index.ts',
        '^@routier/postgres-plugin-core$': '<rootDir>/../postgres-core/src/index.ts',
        '^@routier/test-utils$': '<rootDir>/../../test-utils/src/index.ts'
    }
};
