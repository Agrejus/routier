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
    setupFiles: ['<rootDir>/test.setup.js'],
    setupFilesAfterEnv: [],
    testTimeout: 10000,
    projects: [
        {
            displayName: 'core',
            testMatch: ['<rootDir>/core/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            transform: {
                '^.+\\.ts$': ['ts-jest', {
                    tsconfig: {
                        lib: ['ESNext', 'ES2023'],
                        target: 'ESNext',
                        esModuleInterop: true,
                        allowSyntheticDefaultImports: true
                    }
                }]
            }
        },
        {
            displayName: 'datastore',
            testMatch: ['<rootDir>/datastore/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node',
            moduleNameMapper: {
                '^@routier/core$': '<rootDir>/core/src/index.ts',
                '^@routier/core/(.*)$': '<rootDir>/core/src/$1',
                '^@routier/memory-plugin$': '<rootDir>/plugins/memory/src/index.ts',
                '^@routier/test-utils$': '<rootDir>/test-utils/src/index.ts'
            },
            transformIgnorePatterns: [
                'node_modules/(?!(@routier)/)'
            ],
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
            }
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
            // Avoid duplicate @routier/memory-plugin in Haste map: replication (and others) depend on it,
            // so nested or hoisted node_modules can provide a second path for the same package name.
            modulePathIgnorePatterns: [
                '<rootDir>/plugins/replication/node_modules',
                '<rootDir>/plugins/pouchdb/node_modules',
                '<rootDir>/node_modules/@routier/memory-plugin'
            ],
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
            },
            setupFilesAfterEnv: ['<rootDir>/plugins/dexie/jest.setup.js']
        },
        {
            displayName: 'test-utils',
            testMatch: ['<rootDir>/test-utils/**/*.test.ts'],
            preset: 'ts-jest',
            testEnvironment: 'node'
        }
    ]
};
