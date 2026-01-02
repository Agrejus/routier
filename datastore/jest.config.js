const path = require('path');

module.exports = {
    rootDir: __dirname,
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
        '^@routier/core$': path.resolve(__dirname, '../core/src/index.ts'),
        '^@routier/core/(.*)$': path.resolve(__dirname, '../core/src/$1'),
        '^@routier/memory-plugin$': path.resolve(__dirname, '../plugins/memory/src/index.ts'),
        '^@routier/test-utils$': path.resolve(__dirname, '../test-utils/src/index.ts')
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@routier)/)'
    ],
    setupFiles: ['<rootDir>/../test.setup.js'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                lib: ['ESNext', 'ES2023'],
                target: 'ESNext',
                moduleResolution: 'node',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true
            }
        }]
    },
    watchPathIgnorePatterns: [
        '<rootDir>/../plugins/sync'
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/../plugins/sync'
    ]
};
