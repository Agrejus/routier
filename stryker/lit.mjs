import { area } from '../stryker.base.mjs';

export default area([
    'lit/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.lit.js',
        enableFindRelatedTests: true,
    },
});
