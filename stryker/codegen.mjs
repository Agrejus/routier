import { area } from '../stryker.base.mjs';

// Codegen plus the compile path that drives it. Every generated function (clone, compare,
// hash, merge, strip, enrich, serialize) is produced here, so one surviving mutant can mean
// silent data loss across every schema.
export default area([
    'core/src/codegen/**/*.ts',
    'core/src/schema/SchemaDefinition.ts',
], 85, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.codegen.js',
        enableFindRelatedTests: true,
    },
});
