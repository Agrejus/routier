import { area } from '../../stryker.base.mjs';

export default area([
    'plugins/angular/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.angular.js',
        enableFindRelatedTests: true,
    },
});
