import { area } from '../../stryker.base.mjs';

export default area([
    'cli/src/args.ts',
    'cli/src/generate.ts',
    'cli/src/render.ts',
], 90, {
    jest: {
        projectType: 'custom',
        configFile: 'tooling/stryker/jest.cli.js',
        enableFindRelatedTests: false,
    },
});
