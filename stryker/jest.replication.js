const config = require('../jest.stryker');

const base = config(['<rootDir>/plugins/replication/src/**/*.test.ts']);

module.exports = {
    ...base,
    // The replication package depends on @routier/memory-plugin, so nested and hoisted
    // node_modules can each supply a second path for that package name and Jest's Haste map
    // refuses to start. Same exclusions the root `plugins` project needs.
    modulePathIgnorePatterns: [
        ...(base.modulePathIgnorePatterns ?? []),
        '<rootDir>/plugins/replication/node_modules',
        '<rootDir>/node_modules/@routier/memory-plugin',
    ],
    setupFiles: [...(base.setupFiles ?? []), '<rootDir>/stryker/replication.setup.js'],
};
