const path = require('path');

module.exports = {
    root: true,
    extends: [path.resolve(__dirname, '../.eslintrc.cjs')],
    ignorePatterns: ['node_modules'],
};

