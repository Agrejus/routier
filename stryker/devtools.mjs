import { area } from '../stryker.base.mjs';

export default area([
    'plugins/devtools/src/*/**/*.ts',
    'plugins/devtools/src/*/**/*.tsx',
    'plugins/devtools/src/index.ts',
    'plugins/devtools/src/production.ts',
    'plugins/devtools/src/styles.ts',
    'plugins/devtools/src/mount.ts:16-17',
    '!**/*.test.tsx',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.devtools.dom.js',
        enableFindRelatedTests: false,
    },
});
