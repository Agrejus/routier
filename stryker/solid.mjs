import { area } from '../stryker.base.mjs';

export default area([
    'plugins/solid/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.solid.js',
        enableFindRelatedTests: true,
    },
});
