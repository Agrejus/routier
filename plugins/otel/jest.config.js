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
    '^@routier/memory-plugin$': '<rootDir>/../memory/src/index.ts',
    '^@routier/test-utils$': '<rootDir>/../../test-utils/src/index.ts'
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
};
