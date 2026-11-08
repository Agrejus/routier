import { area } from '../../stryker.base.mjs';

export default area([
    'plugins/memory/src/MemoryPlugin.ts',
    'plugins/memory/src/databases.ts',
], 90, {
    timeoutMS: 15_000,
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.memory.js',
        enableFindRelatedTests: false,
    },
});
