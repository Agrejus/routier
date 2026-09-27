const config = require('../jest.stryker');
const { withPreact } = require('./jest.devtools');

module.exports = {
    ...withPreact(config(['<rootDir>/devtools/src/**/*.test.tsx'])),
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.jsdom.setup.js'],
};
