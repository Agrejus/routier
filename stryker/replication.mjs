import { area } from '../stryker.base.mjs';

// The offline-first sync surface: the durable change queue, HTTP status classification and
// backoff, the SWR read/write paths, and the composition engine. This is the area where a
// missed guard means a write the caller was told succeeded never reaches the server — the
// failure mode ordinary coverage is worst at proving absent.
export default area([
    'plugins/replication/src/**/*.ts',
    // Test-only helper: mutating it measures the harness, not the product.
    '!plugins/replication/src/__tests__/**',
    // 45, not 80. The first full run measured 51.52% (docs/mutation-backlog.md), and a gate
    // above the real score fails every time — which is how this package reached a "gate: 80"
    // it had never been measured against.
    //
    // The margin is deliberately ~6 points rather than the 1 that "just under" would give.
    // That run had 58 TIMEOUTS, and a timeout scores as killed: on a faster or quieter machine
    // some of those become survivors and the score drops by about as much. A gate set one
    // point under a score that moves three is a gate that flaps, which is no better than one
    // that always fails. Target is still 80; raise this as the score moves.
], 45, {
    jest: {
        projectType: 'custom',
        configFile: 'stryker/jest.replication.js',
        enableFindRelatedTests: true,
    },
});
