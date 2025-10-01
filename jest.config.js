module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/core', '<rootDir>/datastore', '<rootDir>/react', '<rootDir>/plugins', '<rootDir>/test-utils'],
    testMatch: [
        '**/__tests__/**/*.ts',
        '**/?(*.)+(spec|test).ts'
    ],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        '**/*.ts',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/coverage/**'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'html'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    setupFilesAfterEnv: [],
    testTimeout: 10000,
    projects: [
        {
            displayName: 'core',
            testMatch: ['<rootDir>/core/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node'
        },
        {
            displayName: 'datastore',
            testMatch: ['<rootDir>/datastore/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node'
        },
        {
            displayName: 'react',
            testMatch: ['<rootDir>/react/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node'
        },
        {
            displayName: 'plugins',
            testMatch: ['<rootDir>/plugins/*/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            moduleNameMapper: {
                '^@routier/core$': '<rootDir>/core/src/index.ts',
                '^@routier/core/(.*)$': '<rootDir>/core/src/$1',
                '^@routier/datastore$': '<rootDir>/datastore/src/index.ts',
                '^@routier/datastore/(.*)$': '<rootDir>/datastore/src/$1',
                '^@routier/memory-plugin$': '<rootDir>/plugins/memory/src/index.ts',
                '^@routier/test-utils$': '<rootDir>/test-utils/src/index.ts'
            },
            transformIgnorePatterns: [
                'node_modules/(?!(@routier|@faker-js)/)'
            ],
            transform: {
                '^.+\\.ts$': ['ts-jest', {
                    tsconfig: {
                        lib: ['ESNext', 'ES2023'],
                        target: 'ESNext',
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true
                    }
                }],
                '^.+\\.js$': ['babel-jest', {
                    presets: [['@babel/preset-env', { targets: { node: 'current' } }]]
                }]
            }
        },
        {
            displayName: 'test-utils',
            testMatch: ['<rootDir>/test-utils/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node'
        }
    ]
};
