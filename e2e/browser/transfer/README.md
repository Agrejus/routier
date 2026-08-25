# Browser tests for the worker-boundary transfer codec

What the Jest suites cannot reach: a real worker, a real `postMessage`, real buffer transfer, a
real Content-Security-Policy, and the real cost of the boundary.

Opt-in. Not part of `npm test`, because it needs a browser.

Lives under `e2e/` rather than in the plugin: it drives a `DataStore` over the plugins, and a
plugin may not depend on the datastore — the dependency runs the other way. `architecture` enforces
that, and caught it when these files were briefly inside `plugins/sqlite`.

## Running

```
npm i -D playwright-core && npx playwright install chromium   # once
npm run test:transfer -w @routier/e2e             # correctness
npm run test:transfer -w @routier/e2e -- --bench  # correctness, then the measurement
```

Headless on purpose. A headed browser throttles timers in an occluded or backgrounded window,
which makes every measurement here wrong in a way that looks plausible.

## What it asserts

The codec's only promise is **identical entities**, so every check compares the same read with
`codec: true` against `codec: false`, at the entity level, fingerprinting values *and types*. A
value-only comparison would miss the failure that matters — a number where a `Date` belongs.

- Chunk boundaries against a real stepping statement: 0, 1, 100, 4095, 4096, 4097 rows.
- Query shapes: whole entities, a filter, a projection, a sort with a window, an aggregate, and a
  nested-object projection.
- The `RETURNING` row of a write.
- Proof the coded path actually ran, so the benchmark cannot be comparing the clone path to itself.
- CSP without `unsafe-eval`: the codec reports itself unsupported, the encoder keeps working, and
  decoding fails loudly rather than misreporting.

## Two things worth knowing

**A query shape that throws must throw the same way on both paths.** `map(x => x.meta)` — a
projection onto an object-typed property — throws `Unsupported deserialization for type: Object` on
*both*. That is a pre-existing limitation of `SqlTranslator.map`, not a codec defect, and the
harness records it as identical behaviour rather than hiding it.

**`page.evaluate` bypasses the page's CSP.** Playwright delivers those callbacks over CDP, which is
exempt from the eval restriction, so a `new Function` called from one succeeds where the same call
in page code throws. Every CSP answer is therefore computed in page code at import time and stored
as a plain value; see `cspProbe.ts`.

## Files

| | |
|---|---|
| `harness.ts` | runs in the page; comparisons and timings, exposed on `window.__harness` |
| `cspProbe.ts` | the codec alone, with no schema in the bundle, under a restrictive policy |
| `build.mjs` | esbuild: bundles from source and inlines `@sqlite.org/sqlite-wasm` |
| `run.mjs` | serves the build, drives Chromium, reports, exits non-zero on failure |

The worker is built as its own entry and handed to the driver through `workerUrl`. That skips
bundler worker-detection entirely — the published path resolves
`new URL('./wasmWorker.js', import.meta.url)`, which every bundler spells differently and none of
which is what is under test here.
