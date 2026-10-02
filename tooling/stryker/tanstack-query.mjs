import { area } from '../../stryker.base.mjs';

export default area([
    'plugins/tanstack-query/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.tanstack-query.js',
        enableFindRelatedTests: true,
    },
});
