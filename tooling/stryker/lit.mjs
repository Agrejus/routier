import { area } from '../../stryker.base.mjs';

export default area([
    'plugins/lit/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.lit.js',
        enableFindRelatedTests: true,
    },
});
