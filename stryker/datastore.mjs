import { area } from '../stryker.base.mjs';

// Datastore orchestration: change tracking, queryables, views, save pipelines. Lowest gate
// of the scoped areas — much of this is wiring whose failure modes surface in the plugin
// contract kit rather than in unit tests.
export default area(['datastore/src/**/*.ts'], 75, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.datastore.js',
        enableFindRelatedTests: true,
    },
});
