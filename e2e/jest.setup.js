// IndexedDB does not exist in Node, so the Dexie plugin cannot run without a stand-in. The
// `plugins` project has had this since Dexie was added; the e2e project needs it too now that
// a suite here exercises Dexie alongside the other backends.
require('fake-indexeddb/auto');

// Jest ignores `testTimeout` in a per-project config (it is a root-level option only), so
// the e2e timeout is set here instead. Real engines and containers are far slower than the
// in-process plugins the 10s global default was chosen for: pulling and starting a Postgres
// container alone exceeds it.
jest.setTimeout(120_000);
