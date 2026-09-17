import { area } from '../stryker.base.mjs';

export default area([
    'vue/src/**/*.ts',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.vue.js',
        enableFindRelatedTests: true,
    },
});
