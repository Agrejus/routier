import { area } from '../stryker.base.mjs';

// Pipeline and collections: sequencing and identity bookkeeping. Lower gate than codegen
// because some branches here are defensive paths a unit test cannot reach without mocking
// the runtime itself.
export default area([
    'core/src/pipeline/**/*.ts',
    'core/src/collections/**/*.ts',
], 80, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.collections.js',
        enableFindRelatedTests: true,
    },
});
