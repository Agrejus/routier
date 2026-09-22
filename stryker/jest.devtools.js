
const withPreact = (base) => {
    const [compiler, options] = base.transform['^.+\\.tsx?$'];
    return {
        ...base,
        testEnvironmentOptions: { customExportConditions: ['node', 'require', 'default'] },
        transform: {
            '^.+\\.tsx?$': [compiler, {
                ...options,
                tsconfig: {
                    ...options.tsconfig,
                    lib: ['ESNext', 'ES2023', 'DOM', 'DOM.Iterable'],
                    jsx: 'react-jsx',
                    jsxImportSource: 'preact',
                },
            }],
        },
    };
};

module.exports = { withPreact };
