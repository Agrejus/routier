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
    '^@routier/test-utils$': '<rootDir>/tooling/test-utils/src/index.ts',
    '^@routier/test-utils/(.*)$': '<rootDir>/tooling/test-utils/src/$1',
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
    '^@routier/react$': '<rootDir>/plugins/react/src/index.ts',
    '^@routier/vue$': '<rootDir>/plugins/vue/src/index.ts',
    '^@routier/svelte$': '<rootDir>/plugins/svelte/src/index.ts',
    '^@routier/solid$': '<rootDir>/plugins/solid/src/index.ts',
    '^@routier/angular$': '<rootDir>/plugins/angular/src/index.ts',
    '^@routier/tanstack-query$': '<rootDir>/plugins/tanstack-query/src/index.ts',
    '^@routier/lit$': '<rootDir>/plugins/lit/src/index.ts',
    '^@routier/devtools/production$': '<rootDir>/plugins/devtools/src/production.ts',
    '^@routier/devtools$': '<rootDir>/plugins/devtools/src/index.ts',
    '^@routier/sync-server$': '<rootDir>/tooling/sync-server/src/index.ts',
};

const tsTransform = {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
};

const devtoolsTransform = {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/plugins/devtools/tsconfig.test.json' }],
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
    modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp', '<rootDir>/.claude/worktrees'],
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
            testMatch: ['<rootDir>/plugins/react/**/*.test.ts?(x)'],
            // Hooks need a DOM. React Testing Library renders into document.body, so this
            // project is the one place the suite departs from the node environment.
            testEnvironment: 'jsdom',
            transform: { ...tsTransform, ...babelTransform },
        },
        {
            ...base,
            displayName: 'vue',
            testMatch: ['<rootDir>/plugins/vue/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'svelte',
            testMatch: ['<rootDir>/plugins/svelte/**/*.test.ts'],
            transform: { ...tsTransform, ...babelTransform },
            transformIgnorePatterns: ['node_modules/(?!(@routier|svelte|esm-env)/)'],
        },
        {
            ...base,
            displayName: 'solid',
            testMatch: ['<rootDir>/plugins/solid/**/*.test.ts'],
            testEnvironmentOptions: { customExportConditions: ['browser', 'require', 'default'] },
        },
        {
            ...base,
            displayName: 'tanstack-query',
            testMatch: ['<rootDir>/plugins/tanstack-query/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'lit',
            testMatch: ['<rootDir>/plugins/lit/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'angular',
            testMatch: ['<rootDir>/plugins/angular/**/*.test.ts'],
            testEnvironment: 'jsdom',
            moduleFileExtensions: ['ts', 'js', 'mjs', 'json'],
            transform: {
                '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/plugins/angular/tsconfig.test.json' }],
                '^.+\\.m?js$': babelTransform['^.+\\.js$'],
            },
            transformIgnorePatterns: ['node_modules/(?!(@routier|@angular)/)'],
            setupFilesAfterEnv: ['<rootDir>/jest.jsdom.setup.js', '<rootDir>/plugins/angular/jest.setup.ts'],
        },
        {
            ...base,
            displayName: 'devtools',
            testMatch: ['<rootDir>/plugins/devtools/**/*.test.ts?(x)'],
            testPathIgnorePatterns: ['/node_modules/', '\\.node\\.test\\.ts$'],
            testEnvironment: 'jsdom',
            testEnvironmentOptions: { customExportConditions: ['node', 'require', 'default'] },
            setupFilesAfterEnv: ['<rootDir>/jest.jsdom.setup.js'],
            transform: devtoolsTransform,
        },
        {
            ...base,
            displayName: 'devtools-node',
            testMatch: ['<rootDir>/plugins/devtools/**/*.node.test.ts'],
            testEnvironmentOptions: { customExportConditions: ['node', 'require', 'default'] },
            transform: devtoolsTransform,
        },
        {
            ...base,
            displayName: 'plugins',
            testMatch: ['<rootDir>/plugins/*/**/*.test.ts'],
            testPathIgnorePatterns: [
                ...(base.testPathIgnorePatterns ?? ['/node_modules/']),
                '<rootDir>/plugins/(react|vue|svelte|solid|angular|tanstack-query|lit|devtools)/',
            ],
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
                '^pouchdb$': '<rootDir>/tooling/test-utils/src/pouchdbMemory.ts',
            },
        },
        {
            ...base,
            displayName: 'e2e',
            testMatch: ['<rootDir>/tooling/e2e/**/*.test.ts'],
            moduleNameMapper: {
                ...moduleNameMapper,
                // Same reason as the `plugins` project: the `pouchdb` meta-package loads
                // leveldown at require time and it has no prebuilt binary for current Node.
                // This build adds the http adapter, which the CouchDB replication suite
                // needs to address a remote by URL.
                '^pouchdb$': '<rootDir>/tooling/test-utils/src/pouchdbHttp.ts',
            },
            // Real storage engines and containers are slower than in-process plugins.
            // The timeout lives in the setup file because Jest ignores `testTimeout` in a
            // per-project config.
            setupFilesAfterEnv: ['<rootDir>/tooling/e2e/jest.setup.js'],
        },
        {
            ...base,
            displayName: 'stress',
            testMatch: ['<rootDir>/tooling/stress/**/*.test.ts'],
            // Volume and churn scenarios run for minutes, not milliseconds. Same reason as
            // e2e: `testTimeout` is a root-level option Jest ignores per project.
            //
            // The suites themselves are gated on STRESS=1 (see tooling/stress/src/harness/scenario.ts),
            // so the default `npx jest` run lists them as skipped rather than executing them.
            setupFilesAfterEnv: ['<rootDir>/tooling/stress/jest.setup.js'],
        },
        {
            ...base,
            displayName: 'benchmark',
            // Only the harness logic is unit tested here. The benchmarks themselves are run
            // by `npm run benchmark`, not by Jest — a timing measurement is not a test.
            testMatch: ['<rootDir>/tooling/benchmark/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'architecture',
            testMatch: ['<rootDir>/tooling/architecture/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'test-utils',
            testMatch: ['<rootDir>/tooling/test-utils/**/*.test.ts'],
        },
        {
            ...base,
            displayName: 'sync-server',
            testMatch: ['<rootDir>/tooling/sync-server/**/*.test.ts'],
        },
    ],
};
