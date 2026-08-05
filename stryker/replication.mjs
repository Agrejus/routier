import { area } from '../stryker.base.mjs';

// The offline-first sync surface: the durable change queue, HTTP status classification and
// backoff, the SWR read/write paths, and the composition engine. This is the area where a
// missed guard means a write the caller was told succeeded never reaches the server — the
// failure mode ordinary coverage is worst at proving absent.
export default area([
    'plugins/replication/src/**/*.ts',
    // Test-only helper: mutating it measures the harness, not the product.
    '!plugins/replication/src/__tests__/**',
], 80, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.replication.js',
        enableFindRelatedTests: true,
    },
});
