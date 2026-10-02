import { area } from '../../stryker.base.mjs';

export default area([
    'plugins/devtools/src/mount.ts:15-15',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.devtools.node.js',
        enableFindRelatedTests: true,
    },
});
