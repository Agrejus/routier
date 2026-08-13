import { area } from '../stryker.base.mjs';

// Highest gate in the program: the parser turns user arrow functions into query trees, and a
// wrong tree is a silently wrong query rather than an error. The inverted-precedence bug the
// audit found lived here, enshrined by a test that asserted the mutant.
export default area(['core/src/expressions/**/*.ts'], 90, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.expressions.js',
        enableFindRelatedTests: true,
    },
});
