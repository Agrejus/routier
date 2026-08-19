import { area } from '../stryker.base.mjs';

// The OpenTelemetry decorator: span naming, attributes, status, and the context nesting that
// makes an inner plugin's own spans children rather than roots.
export default area([
    'plugins/otel/src/**/*.ts',
], 85, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.otel.js',
        enableFindRelatedTests: true,
    },
});
