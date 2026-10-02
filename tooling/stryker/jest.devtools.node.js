const config = require('../../jest.stryker');
const { withPreact } = require('./jest.devtools');

module.exports = withPreact(config(['<rootDir>/plugins/devtools/src/**/*.node.test.ts']));
