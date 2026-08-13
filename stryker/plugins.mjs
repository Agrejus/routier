import { area } from '../stryker.base.mjs';

// The in-process plugin surface: ephemeral storage, query translation, and the option
// routing table that decides which options a plugin handles versus which fall back to JS.
export default area([
    'core/src/plugins/**/*.ts',
], 85, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.plugins.js',
        enableFindRelatedTests: true,
    },
});
