const config = require('../jest.stryker');

const PROJECT_KEYS = ['transform', 'transformIgnorePatterns', 'testEnvironment', 'testEnvironmentOptions', 'setupFilesAfterEnv', 'moduleFileExtensions'];

module.exports = function fromProject(displayName) {
    const project = require('../jest.config').projects.find(p => p.displayName === displayName);
    const overrides = Object.fromEntries(PROJECT_KEYS.filter(key => project[key] != null).map(key => [key, project[key]]));

    return { ...config(project.testMatch), ...overrides };
};
