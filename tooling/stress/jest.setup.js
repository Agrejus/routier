// Jest ignores `testTimeout` in a per-project config (it is a root-level option only), so
// the stress timeout is set here. Scenarios move six-figure entity counts through real
// save pipelines; the 10s global default is for single-operation functional tests.
//
// The per-file budget in specs/stress-testing.md is 5 minutes. This ceiling sits just
// above it so a scenario that blows its budget fails as a timeout rather than hanging.
jest.setTimeout(330_000);
