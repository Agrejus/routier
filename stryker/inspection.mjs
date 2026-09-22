import { area } from '../stryker.base.mjs';

export default area([
    'datastore/src/inspection/**/*.ts',
    'datastore/src/collections/CollectionBase.ts:165-168',
    'datastore/src/collections/types.ts:155:66-155:96',
    'datastore/src/queryable/QueryableExecutor.ts:63-81',
    'datastore/src/DataStore.ts:465-467',
], 100, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.inspection.js',
        enableFindRelatedTests: false,
    },
});
