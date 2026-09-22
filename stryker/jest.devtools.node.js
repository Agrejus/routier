const config = require('../jest.stryker');
const { withPreact } = require('./jest.devtools');

module.exports = withPreact(config(['<rootDir>/devtools/src/**/*.node.test.ts']));
