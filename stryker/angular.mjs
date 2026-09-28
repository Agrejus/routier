import { area } from '../stryker.base.mjs';

export default area([
    'angular/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.angular.js',
        enableFindRelatedTests: true,
    },
});
