// Jest config factory for StrykerJS.
//
// Two reasons this exists rather than reusing jest.config.js directly:
//
// 1. jest.config.js uses `projects`, which the Stryker jest runner cannot introspect — it
//    looks for `testMatch` at the top level and otherwise reports "No tests were found".
// 2. Stryker builds a sandbox copy of the repo, so the transform must not depend on files
//    that may be absent there. The compiler options are inlined rather than pointing at
//    tsconfig.test.json.
//
// Each mutation area supplies its own `testMatch` via stryker/jest.<area>.js.
//
// Scoping is a real trade-off, not free. It cuts runtime sharply — the unscoped expressions
// run took ~19 minutes because every one of ~1400 mutants re-ran all 469 core + datastore
// tests. But a test set that is too narrow loses coverage outright: mutants no remaining
// test reaches become "no coverage", which counts against the score exactly like a survivor.
// Scoping expressions to core/src/expressions alone moved 22 mutants to "no coverage" and
// dropped the score. Each area's globs must therefore include every suite that exercises the
// mutated code, not just the suite that sits beside it.
const { moduleNameMapper } = require('./jest.config').projects.find(p => p.displayName === 'core');

/** @param {string[]} testMatch Test globs that cover the mutated area. */
module.exports = function strykerJestConfig(testMatch) {
    return {
        preset: 'ts-jest',
        testEnvironment: 'node',
        rootDir: __dirname,
        moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
        setupFiles: ['<rootDir>/test.setup.js'],
        moduleNameMapper,
        transformIgnorePatterns: ['node_modules/(?!(@routier|@faker-js)/)'],
        transform: {
            '^.+\\.tsx?$': ['ts-jest', {
                // Type-strips instead of running the language service. `disableTypeChecks`
                // in stryker.base.mjs already discards type errors, so the compile was work
                // whose only output was thrown away.
                isolatedModules: true,
                tsconfig: {
                    lib: ['ESNext', 'ES2023'],
                    target: 'ESNext',
                    module: 'ESNext',
                    moduleResolution: 'node',
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true,
                    resolveJsonModule: true,
                    skipLibCheck: true,
                },
            }],
        },
        testMatch,
        // Stryker copies the repo into .stryker-tmp sandboxes; without this, Jest's Haste
        // map sees several copies of every package.json and refuses to start.
        modulePathIgnorePatterns: ['<rootDir>/.stryker-tmp'],
        // The whole suite nets ~1.5s of actual test time, so a mutant still running after five
        // seconds has hung rather than slowed. A hung mutant is detected either way; the only
        // thing a longer wait buys is wall clock. 2000 was too tight — it timed out tests that
        // were merely slow, which cost more than it saved.
        testTimeout: 5000,
        // Stryker runs one mutant per test run; suite console noise drowns its progress.
        silent: true,
    };
};
