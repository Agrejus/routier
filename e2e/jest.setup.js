// Jest ignores `testTimeout` in a per-project config (it is a root-level option only), so
// the e2e timeout is set here instead. Real engines and containers are far slower than the
// in-process plugins the 10s global default was chosen for: pulling and starting a Postgres
// container alone exceeds it.
jest.setTimeout(120_000);
