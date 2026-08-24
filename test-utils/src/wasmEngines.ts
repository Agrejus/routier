/**
 * Whether Jest can run a WebAssembly database in this process.
 *
 * PGlite reaches its WASM through `await import()`, out of Emscripten's own glue code, and a
 * Jest VM context refuses that without `--experimental-vm-modules`. The rejection arrives as an
 * UNCAUGHT exception that takes the worker down, so there is nothing to try and catch — a suite
 * has to ask before it touches the engine.
 *
 * The flag is NOT on for the default `npm test`. Turning it on globally makes Jest refuse to
 * `require` `@faker-js/faker`'s ESM build, which six plugin suites import, so it is set only on
 * the scripts whose suites need it: `test:e2e`, `test:e2e:containers`, and the PGlite plugin's
 * own `npm test`.
 *
 * Use it to pick the block, so the suite is LISTED as skipped rather than silently missing:
 *
 *   (vmModulesEnabled ? describe : describe.skip)('PGlite', () => { ... });
 */
export const vmModulesEnabled = [
    ...process.execArgv,
    ...(process.env.NODE_OPTIONS ?? '').split(/\s+/),
].includes('--experimental-vm-modules');
