import { area } from '../stryker.base.mjs';

// The in-process plugin surface: ephemeral storage, query translation, and the option
// routing table that decides which options a plugin handles versus which fall back to JS.
export default area([
    'core/src/plugins/**/*.ts',
], 85, {
    // Not the 60s base default, which exists for codegen. Nothing here legitimately runs that
    // long, so the budget only ever paid for mutants that hung the callback chain.
    timeoutMS: 15_000,
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.plugins.js',
        enableFindRelatedTests: true,
    },
});
