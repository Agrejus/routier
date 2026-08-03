/**
 * Shared StrykerJS configuration. Per-area configs extend this and set `mutate` plus their
 * own `thresholds.break`.
 *
 * Mutation testing is the check on the checks: it edits the source (flips comparisons,
 * deletes statements, swaps operators) and verifies the suite notices. The audit that
 * prompted this program found an inverted-precedence bug whose test asserted the mutant, so
 * coverage numbers alone were not evidence of anything.
 *
 * Runs are expensive — one mutant per test run — so these are scoped per area and intended
 * for nightly and for PRs that touch the scoped paths, not for every commit.
 */

/** @type {Partial<import('@stryker-mutator/api/core').PartialStrykerOptions>} */
export const base = {
    packageManager: 'npm',
    testRunner: 'jest',
    reporters: ['html', 'clear-text', 'progress'],
    coverageAnalysis: 'perTest',
    jest: {
        projectType: 'custom',
        configFile: 'jest.stryker.js',
        enableFindRelatedTests: true,
    },
    // Generated code is evaluated at runtime from strings, so a mutant inside a codegen
    // template only shows up when the generated function runs. perTest coverage keeps that
    // attribution correct.
    // NOTE: `ignorePatterns` controls what is copied into the sandbox, NOT what is
    // mutated. Excluding '**/*.test.ts' here removes the very tests Stryker needs to run
    // and produces "No tests were executed". Test files are kept out of the mutation set
    // by the `mutate` globs instead — see `area()`.
    ignorePatterns: [
        'node_modules',
        'dist',
        'coverage',
        'docs',
        'examples',
        'reports',
        '.stryker-tmp',
    ],
    timeoutMS: 60_000,
    // Codegen builds and evaluates source per compile, so a mutated generator can be much
    // slower than the original without being an infinite loop.
    timeoutFactor: 3,
    disableTypeChecks: true,
    tempDirName: '.stryker-tmp',
};

/**
 * Builds an area config.
 *
 * @param {string[]} mutate Globs to mutate.
 * @param {number} breakAt Mutation score below which the run fails.
 * @param {object} [overrides]
 */
export function area(mutate, breakAt, overrides = {}) {
    return {
        ...base,
        // Tests are excluded from the mutation set here rather than from the sandbox, so
        // they are still available to run against each mutant.
        mutate: [...mutate, '!**/*.test.ts'],
        thresholds: {
            // `break` fails the run. `high`/`low` only colour the report.
            break: breakAt,
            low: breakAt,
            high: Math.min(100, breakAt + 10),
        },
        ...overrides,
    };
}
