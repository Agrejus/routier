import { area } from '../stryker.base.mjs';

export default area([
    'plugins/svelte/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.svelte.js',
        enableFindRelatedTests: true,
    },
});
