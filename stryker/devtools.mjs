import { area } from '../stryker.base.mjs';

export default area([
    'devtools/src/*/**/*.ts',
    'devtools/src/*/**/*.tsx',
    'devtools/src/index.ts',
    'devtools/src/production.ts',
    'devtools/src/styles.ts',
    'devtools/src/mount.ts:16-17',
    '!**/*.test.tsx',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.devtools.dom.js',
        enableFindRelatedTests: false,
    },
});
