// Workspace packages point `main`/`types` at ./dist, which only exists after a build.
// Tests resolve every @routier/* import to source so `npx jest` works on a clean
// checkout with no build step. The runtime side is `moduleNameMapper`; the type side is
// tsconfig.test.json's `paths`. Both lists must stay in sync — a name present in one but
// not the other fails at either runtime or typecheck.
const moduleNameMapper = {
    '^@routier/core$': '<rootDir>/core/src/index.ts',
    '^@routier/core/(.*)$': '<rootDir>/core/src/$1',
    '^@routier/datastore$': '<rootDir>/datastore/src/index.ts',
    '^@routier/datastore/(.*)$': '<rootDir>/datastore/src/$1',
    '^@routier/test-utils$': '<rootDir>/test-utils/src/index.ts',
    '^@routier/test-utils/(.*)$': '<rootDir>/test-utils/src/$1',
    '^@routier/memory-plugin$': '<rootDir>/plugins/memory/src/index.ts',
    '^@routier/memory-plugin/(.*)$': '<rootDir>/plugins/memory/src/$1',
    '^@routier/dexie-plugin$': '<rootDir>/plugins/dexie/src/index.ts',
    '^@routier/browser-storage-plugin$': '<rootDir>/plugins/browser-storage/src/index.ts',
    '^@routier/file-system-plugin$': '<rootDir>/plugins/file-system/src/index.ts',
    '^@routier/sql-plugin-core$': '<rootDir>/plugins/sql-core/src/index.ts',
    '^@routier/postgres-plugin-core$': '<rootDir>/plugins/postgres-core/src/index.ts',
    '^@routier/pglite-plugin$': '<rootDir>/plugins/pglite/src/index.ts',
    '^@routier/blob-plugin$': '<rootDir>/plugins/blob/src/index.ts',
    '^@routier/encryption$': '<rootDir>/plugins/encryption/src/index.ts',
    '^@routier/blob-plugin/(.*)$': '<rootDir>/plugins/blob/src/$1',
    // Subpath first: a bare-name pattern would swallow it.
    '^@routier/sqlite-plugin/d1$': '<rootDir>/plugins/sqlite/src/d1.ts',
    '^@routier/sqlite-plugin$': '<rootDir>/plugins/sqlite/src/index.ts',
    '^@routier/pouchdb-plugin$': '<rootDir>/plugins/pouchdb/src/index.ts',
    '^@routier/postgresql-plugin$': '<rootDir>/plugins/postgresql/src/index.ts',
    '^@routier/mysql-plugin$': '<rootDir>/plugins/mysql/src/index.ts',
    '^@routier/mongodb-plugin$': '<rootDir>/plugins/mongodb/src/index.ts',
    '^@routier/otel-plugin$': '<rootDir>/plugins/otel/src/index.ts',
    '^@routier/replication-plugin$': '<rootDir>/plugins/replication/src/index.ts',
    '^@routier/react$': '<rootDir>/react/src/index.ts',
    '^@routier/sync-server$': '<rootDir>/sync-server/src/index.ts',
};

const tsTransform = {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
};

// Some workspace packages and @faker-js ship ESM-only .js that Jest cannot parse
// without a downlevel pass.
const babelTransform = {
    '^.+\\.js$': ['babel-jest', {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
};

/** Shared settings every project spreads over. */
const base = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    transform: tsTransform,
    moduleNameMapper,
    transformIgnorePatterns: ['node_modules/(?!(@routier|@faker-js)/)'],
    // StrykerJS copies the whole repo into .stryker-tmp sandboxes. Without this, a Jest run
    // started while a mutation run is in progress sees two package.json files claiming the
    // same module name and refuses to start.
    modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp'],
};

module.exports = {
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    setupFiles: ['<rootDir>/test.setup.js'],
    testTimeout: 10000,
    collectCoverageFrom: [
        '**/*.ts',
        '!**/*.d.ts',
        '!**/*.test.ts',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/coverage/**',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'html'],
    projects: [
        {
            ...base,
            displayName: 'core',
            testMatch: ['<rootDir>/core/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'datastore',
            testMatch: ['<rootDir>/datastore/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'react',
            testMatch: ['<rootDir>/react/**/*.test.ts?(x)'],
            // Hooks need a DOM. React Testing Library renders into document.body, so this
            // project is the one place the suite departs from the node environment.
            testEnvironment: 'jsdom',
            transform: { ...tsTransform, ...babelTransform },
        },
        {
            ...base,
            displayName: 'plugins',
            testMatch: ['<rootDir>/plugins/*/**/*.test.ts'],
            transform: { ...tsTransform, ...babelTransform },
            // Avoid duplicate @routier/memory-plugin in the Haste map: replication (and
            // others) depend on it, so nested or hoisted node_modules can provide a second
            // path for the same package name.
            modulePathIgnorePatterns: [
                ...base.modulePathIgnorePatterns,
                '<rootDir>/plugins/replication/node_modules',
                '<rootDir>/plugins/pouchdb/node_modules',
                '<rootDir>/node_modules/@routier/memory-plugin',
            ],
            setupFilesAfterEnv: ['<rootDir>/plugins/dexie/jest.setup.js'],
            moduleNameMapper: {
                ...moduleNameMapper,
                // The `pouchdb` meta-package loads leveldown at require time, which has
                // no prebuilt binary for current Node. Swap in a core+memory-adapter
                // build so these suites run without a native toolchain.
                '^pouchdb$': '<rootDir>/test-utils/src/pouchdbMemory.ts',
            },
        },
        {
            ...base,
            displayName: 'e2e',
            testMatch: ['<rootDir>/e2e/**/*.test.ts'],
            moduleNameMapper: {
                ...moduleNameMapper,
                // Same reason as the `plugins` project: the `pouchdb` meta-package loads
                // leveldown at require time and it has no prebuilt binary for current Node.
                // This build adds the http adapter, which the CouchDB replication suite
                // needs to address a remote by URL.
                '^pouchdb$': '<rootDir>/test-utils/src/pouchdbHttp.ts',
            },
            // Real storage engines and containers are slower than in-process plugins.
            // The timeout lives in the setup file because Jest ignores `testTimeout` in a
            // per-project config.
            setupFilesAfterEnv: ['<rootDir>/e2e/jest.setup.js'],
        },
        {
            ...base,
            displayName: 'stress',
            testMatch: ['<rootDir>/stress/**/*.test.ts'],
            // Volume and churn scenarios run for minutes, not milliseconds. Same reason as
            // e2e: `testTimeout` is a root-level option Jest ignores per project.
            //
            // The suites themselves are gated on STRESS=1 (see stress/src/harness/scenario.ts),
            // so the default `npx jest` run lists them as skipped rather than executing them.
            setupFilesAfterEnv: ['<rootDir>/stress/jest.setup.js'],
        },
        {
            ...base,
            displayName: 'benchmark',
            // Only the harness logic is unit tested here. The benchmarks themselves are run
            // by `npm run benchmark`, not by Jest — a timing measurement is not a test.
            testMatch: ['<rootDir>/benchmark/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'architecture',
            testMatch: ['<rootDir>/architecture/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'test-utils',
            testMatch: ['<rootDir>/test-utils/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'sync-server',
            testMatch: ['<rootDir>/sync-server/**/*.test.ts'],
        },
    ],
};
