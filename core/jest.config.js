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
};
