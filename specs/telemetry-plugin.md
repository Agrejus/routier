# Telemetry: TelemetryDbPlugin, @routier/otel-plugin, and removal of the capabilities system

## Goal

Three deliverables, in this order:

1. **Part A** — Add `TelemetryDbPlugin` (a decorator plugin) plus two sink factories to `@routier/core`.
2. **Part B** — Create a new package `@routier/otel-plugin` at `plugins/otel` that exports `OtelDbPlugin`.
3. **Part C** — Delete the old reflection-based logging system (`core/src/capabilities/`) and every reference to it.

Do the parts in order. Verify each part (see "Verification" in each part) before you start the next.

## Rules for this task

- Do NOT change `IDbPlugin` in `core/src/plugins/types.ts`. The plugin contract is frozen. Both new plugins implement it as-is.
- Do NOT add any dependency to `@routier/core`. Part A uses zero new dependencies.
- Do NOT run a bare `npm install <pkg>` at the repo root without care: npm silently deletes native optional dependencies for other workspaces. If a later test run fails with a missing native binding (e.g. better-sqlite3), run a full `npm install` at the root once to restore everything.
- Copy the code skeletons below exactly unless they fail to compile; if they fail, fix the smallest thing that makes them compile and keep the behavior described.
- Pre-existing noise you must NOT try to fix: some suites print TS7011 TypeScript warnings locally. That is not a regression. Judge test runs by pass/fail, not by warnings.
- Match the surrounding code style. Comments: maximum 2 lines, and only for facts the code cannot show.

## Files to read before writing any code

1. `core/src/plugins/RetryDbPlugin.ts` — the decorator pattern both new plugins copy.
2. `core/src/plugins/RetryDbPlugin.test.ts` — the unit-test pattern (a `FlakyPlugin` fake inner plugin, direct event construction).
3. `core/src/plugins/types.ts` — `IDbPlugin`, `DbPluginEvent`, `DbPluginQueryEvent`, `DbPluginBulkPersistEvent`.
4. `core/src/results/types.ts` — result envelope. `result.ok` is the string `"success" | "partial" | "error"`.
5. `core/src/utilities/logger.ts` — the levelled logger. It stays. Part C does not touch it.

---

## Part A — `TelemetryDbPlugin` in `@routier/core`

### A1. Create `core/src/plugins/TelemetryDbPlugin.ts`

Requirements:

- Implements `IDbPlugin`. Wraps an inner plugin, passed to the constructor.
- On each of `query`, `bulkPersist`, `destroy`: record `performance.now()` before calling the inner plugin, and when the inner plugin's callback fires, build ONE `TelemetryEvent` and pass it to the sink, THEN call `done(result)` with the result object untouched (same reference, no copy).
- A sink that throws must never break the data operation: wrap the sink call in try/catch and swallow.
- Emit exactly once per call. Never mutate the event or the result.

Skeleton (fix imports to match real paths):

```ts
import { BulkPersistResult } from "../collections";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";
import { logger } from "../utilities";

export type TelemetryEvent = {
    operation: "query" | "bulkPersist" | "destroy";
    /** `id` of the plugin event that produced this measurement. */
    eventId: string;
    /** The class/component that triggered the operation (`event.source`). */
    source: string;
    /** Collection names involved, from `event.schemas`. */
    schemas: string[];
    durationMs: number;
    ok: "success" | "partial" | "error";
    /** Present when ok is "error" or "partial". */
    error?: unknown;
};

export type TelemetrySink = (e: TelemetryEvent) => void;

export type TelemetryDbPluginOptions = {
    /** Where events go. Default: `loggerSink()`. */
    onEvent?: TelemetrySink;
};

/** Default sink: writes through the levelled logger, so ROUTIER_LOG_LEVEL governs it. */
export const loggerSink = (): TelemetrySink => e => {
    const line = `[routier] ${e.operation} ${e.schemas.join(",")} ${e.durationMs.toFixed(1)}ms`;
    if (e.ok === "error") {
        logger.error(line, e.error);
        return;
    }
    logger.info(line);
};

/** Pushes every event into `into`. For tests and custom buffering. */
export const collectingSink = (into: TelemetryEvent[]): TelemetrySink => e => {
    into.push(e);
};

export class TelemetryDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly onEvent: TelemetrySink;

    constructor(plugin: IDbPlugin, options: TelemetryDbPluginOptions = {}) {
        this.plugin = plugin;
        this.onEvent = options.onEvent ?? loggerSink();
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const start = performance.now();
        this.plugin.query<TRoot, TShape>(event, result => {
            this.emit("query", event, result, start);
            done(result);
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        const start = performance.now();
        this.plugin.bulkPersist(event, result => {
            this.emit("bulkPersist", event, result, start);
            done(result);
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        const start = performance.now();
        this.plugin.destroy(event, result => {
            this.emit("destroy", event, result, start);
            done(result);
        });
    }

    private emit(
        operation: TelemetryEvent["operation"],
        event: DbPluginEvent,
        result: { ok: "success" | "partial" | "error"; error?: unknown },
        start: number
    ): void {
        try {
            this.onEvent({
                operation,
                eventId: event.id,
                source: event.source,
                schemas: [...event.schemas.values()].map(s => s.collectionName),
                durationMs: performance.now() - start,
                ok: result.ok,
                error: result.ok === "success" ? undefined : (result as { error?: unknown }).error,
            });
        } catch {
            // A broken sink must never fail the data operation.
        }
    }
}
```

### A2. Export it

Add to `core/src/plugins/index.ts`:

```ts
export * from './TelemetryDbPlugin';
```

### A3. Unit tests — create `core/src/plugins/TelemetryDbPlugin.test.ts`

Model the file on `core/src/plugins/RetryDbPlugin.test.ts`: build a fake inner `IDbPlugin` class in the test file, construct events the same way that file does. Reuse its `FlakyPlugin` shape (copy it; do not import from another test file).

Required test cases. Each is one `it(...)`:

1. `query` success: sink receives exactly one event with `operation: "query"`, `ok: "success"`, `eventId` equal to the event's `id`, `source` equal to the event's `source`, and `durationMs >= 0`.
2. `query` error: inner plugin calls `done` with an error result → sink event has `ok: "error"` and `error` set to the inner error. `done` still receives the error result.
3. `bulkPersist` success: one event, `operation: "bulkPersist"`, `ok: "success"`.
4. `bulkPersist` partial: inner calls `done` with a partial result (`PluginEventResult.partial(...)` — check `core/src/results` for the factory) → sink event `ok: "partial"` and `error` set.
5. `destroy`: one event, `operation: "destroy"`.
6. Result passthrough: the result object received by `done` is the SAME reference the inner plugin produced (`toBe`, not `toEqual`).
7. Throwing sink: `onEvent` throws → `done` still fires with the inner result, and no exception escapes.
8. Default sink: construct with no options, spy on `logger.info` (import `setLogLevel` from `core/src/utilities/logger` and set level `"info"` first; restore with `resetLogLevel` after), run a query, assert `logger` was called. Use `jest.spyOn(console, "info")` if spying on the logger object directly is awkward.
9. `schemas`: event built with a `SchemaCollection` containing a known compiled schema → sink event `schemas` contains that collection name. Look at how other core tests build a `SchemaCollection`; if none do it cheaply, build one with `new SchemaCollection()` and `.set(schema.id, schema)` using a schema compiled the way `RetryDbPlugin.test.ts` or neighbouring tests do it. If constructing a compiled schema in core tests proves impractical, cover this assertion in the acceptance test (A4) instead and note it in the test file.
10. `emit` exactly once: a sink counter is 1 after one query, 3 after three.

### A4. Acceptance test — create `plugins/memory/src/tests/telemetry.test.ts`

Model on `plugins/memory/src/tests/comments.test.ts` (factory + `TestDataStore`), but wrap the plugin:

```ts
const events: TelemetryEvent[] = [];
const store = new TestDataStore(new TelemetryDbPlugin(new MemoryPlugin(uuidv4()), { onEvent: collectingSink(events) }));
```

Required assertions:

1. Add an entity + `saveChangesAsync()` → at least one event with `operation: "bulkPersist"` and `ok: "success"`, and its `schemas` includes the collection's name.
2. Run a query (e.g. `toArrayAsync()`) → at least one event with `operation: "query"` and `ok: "success"`.
3. All recorded events have `durationMs >= 0` and a non-empty `eventId`.
4. The store behaves identically to an unwrapped store: the add/query results themselves are still correct (assert on the returned entities, same style as `comments.test.ts`).
5. Composition: build `new TelemetryDbPlugin(new RetryDbPlugin(new MemoryPlugin(uuidv4())))` inside a `TestDataStore`, add + save + query, assert data operations succeed and events were emitted. This pins that the decorators stack.

### A5. Verification for Part A

Run from the repo root:

1. `npx tsc --noEmit -p core` (or `npm run tsc --workspace=core` — use whichever script exists in `core/package.json`).
2. `npm test --workspace=core` — all pass.
3. `npm test --workspace=plugins/memory` — all pass (workspace name may be `@routier/memory-plugin`; check `plugins/memory/package.json`).
4. Mutation testing: `npx stryker run stryker/plugins.mjs` from the repo root. The `core/src/plugins/**` glob already includes the new file. The run must meet the configured break threshold (85). If surviving mutants are inside `TelemetryDbPlugin.ts`, add tests that kill them. Do not lower the threshold. This run is slow; run it once after the unit tests pass, not repeatedly.

---

## Part B — `@routier/otel-plugin` at `plugins/otel`

### B1. Package scaffolding

Create `plugins/otel/` modeled on `plugins/dexie/` (copy its `package.json`, `tsconfig.json`, `rspack.config.mjs`, `jest.config.js`, LICENSE, and adjust). Rules:

- `name`: `@routier/otel-plugin`. `version`: match the current version of the other plugin packages (see `plugins/dexie/package.json`).
- `description`: "OpenTelemetry plugin for routier".
- `peerDependencies`: `@routier/core` (same range as dexie uses) AND `@opentelemetry/api` (use `^1.9.0` or the latest 1.x).
- `devDependencies`: `@routier/core` (workspace version), `@routier/test-utils` (`file:../../test-utils`), `@opentelemetry/api`, `@opentelemetry/sdk-trace-base` (for the in-memory exporter in tests), plus the rspack build deps the dexie package lists.
- NO runtime `dependencies`. The OTel API comes from the host application.
- Remove dexie-specific things: the `dexie` dependency, `fake-indexeddb`, `jsdom`, indexeddb keywords.
- Register the workspace: check the root `package.json` `workspaces` field. If it lists globs (e.g. `plugins/*`), nothing to do; if it lists paths explicitly, add `plugins/otel`.
- After scaffolding, run `npm install` ONCE at the repo root to link the workspace. If any other package's tests later fail with a missing native binding, run root `npm install` again — that restores all native optional deps at once.
- Write a `README.md` following the structure of an existing plugin README (e.g. `plugins/dexie/README.md`): what it is, install, one usage example.

### B2. Create `plugins/otel/src/OtelDbPlugin.ts` and `plugins/otel/src/index.ts`

`index.ts` re-exports everything from `OtelDbPlugin.ts`.

Behavior requirements:

- Implements `IDbPlugin`, wraps an inner plugin.
- For each of the three methods: start a span BEFORE calling the inner plugin, run the inner call inside `context.with(trace.setSpan(context.active(), span), ...)` so anything the inner plugin does nests under the span, and end the span in the callback before calling `done`.
- Span names: `routier.query`, `routier.bulkPersist`, `routier.destroy`.
- Span attributes set at start: `db.system` = `plugin.databaseName`, `db.collection.name` = comma-joined collection names from `event.schemas`, `routier.source` = `event.source`, `routier.event.id` = `event.id`.
- On `ok === "error"`: `span.recordException(error)` (cast to `Error` only if it is one; otherwise `span.recordException(String(error))` — the API accepts a string) and `span.setStatus({ code: SpanStatusCode.ERROR })`.
- On `ok === "partial"` (bulkPersist only): record the exception the same way but set status `ERROR` with `message: "partial"`.
- For `query`, after the inner callback: if `event.executedQueries.length > 0`, set attribute `db.query.text` to `event.executedQueries.map(q => q.text).join("; ")`.
- `span.end()` must be called on every path, including when the span-attribute code throws — wrap the bookkeeping in try/finally with `span.end()` and `done(result)` in the finally? NO — simpler and required: wrap ONLY the attribute/status bookkeeping in try/catch (swallow), then `span.end()`, then `done(result)`. `done` must always be called exactly once with the untouched result.
- Constructor: `constructor(plugin: IDbPlugin, tracer?: Tracer)`; default tracer is `trace.getTracer("routier")`.

Skeleton:

```ts
import { trace, context, SpanStatusCode, type Tracer, type Span } from "@opentelemetry/api";
import {
    IDbPlugin, DbPluginEvent, DbPluginQueryEvent, DbPluginBulkPersistEvent,
} from "@routier/core/plugins";
import { PluginEventCallbackResult, PluginEventCallbackPartialResult } from "@routier/core/results";
import { ITranslatedValue } from "@routier/core/plugins";
import { BulkPersistResult } from "@routier/core/collections";
```

(Verify these import paths against `core/package.json` `exports`; use whatever subpaths the other plugin packages use to import from core.)

### B3. Unit tests — `plugins/otel/src/OtelDbPlugin.test.ts` (or a `__tests__` dir if the dexie package uses one; match it)

Use a real in-memory OTel pipeline — no Docker needed:

```ts
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
const tracer = provider.getTracer("test");
```

(If the installed sdk-trace-base version wants `provider.addSpanProcessor(...)` instead of the constructor option, use that form.)

Use the same fake inner-plugin pattern as `core/src/plugins/RetryDbPlugin.test.ts`.

Required test cases:

1. `query` success → exactly one finished span named `routier.query`, status not ERROR, attributes `db.system`, `routier.source`, `routier.event.id` all present and correct.
2. `query` error → span status is ERROR and the span has one exception event.
3. `bulkPersist` success → span `routier.bulkPersist`.
4. `bulkPersist` partial → span status ERROR.
5. `destroy` → span `routier.destroy`.
6. `executedQueries`: fake inner plugin pushes `{ text: "SELECT 1" }`-shaped entries (match the real `ExecutedQuery` type from core) into `event.executedQueries` before calling done → span attribute `db.query.text` is `"SELECT 1"`.
7. Nesting: inside the fake inner plugin's `query`, call `tracer.startSpan("child").end()` — assert the child span's `parentSpanId` (or `parentSpanContext.spanId`, depending on SDK version) equals the `routier.query` span's `spanId`. This pins the `context.with` behavior.
8. Result passthrough: `done` receives the same result reference (`toBe`).
9. Default tracer: constructing without a tracer works and a query still calls `done` (no span assertions needed — the global tracer is a no-op in tests).
10. Span always ends: make `event.schemas` an empty collection and error path both still produce an ENDED span (exporter only receives ended spans, so "exporter received it" is the assertion).

### B4. Acceptance test — `plugins/otel/src/acceptance.test.ts`

Wrap the real memory plugin end-to-end:

- devDependency on `@routier/memory-plugin` (`file:../memory` if that is how other packages cross-reference; otherwise the workspace version).
- Build a datastore the way `plugins/memory/src/tests/datastore/MemoryDatastore.ts` does (import it if exported; otherwise define a minimal store class in the test using a schema from `@routier/test-utils`).
- `new OtelDbPlugin(new MemoryPlugin(uuidv4()), tracer)` with the InMemorySpanExporter pipeline.
- Assert: add + save produces a `routier.bulkPersist` span; a query produces a `routier.query` span; the data results themselves are correct.
- If wiring the memory plugin as a dev dependency creates a dependency cycle or workspace problem, instead put this acceptance test in `plugins/memory/src/tests/otel.test.ts` with `@routier/otel-plugin` as a memory-plugin devDependency — pick whichever direction npm workspaces accepts, and note the choice in the test file header.

### B5. Mutation testing for Part B

Create `stryker/otel.mjs` modeled on `stryker/plugins.mjs`:

```ts
import { area } from '../stryker.base.mjs';

export default area([
    'plugins/otel/src/**/*.ts',
], 85, { /* copy the jest override pattern from plugins.mjs, pointing at a jest config that runs the otel tests */ });
```

Look at how `stryker/jest.plugins.js` scopes its jest run and create `stryker/jest.otel.js` the same way. Run `npx stryker run stryker/otel.mjs` and meet the 85 threshold. If the harness genuinely cannot run stryker against a workspace package (e.g. module resolution failures you cannot fix within this task), document exactly what failed at the bottom of this spec file under a "## Implementation notes" heading and make sure the jest tests alone are airtight.

### B6. Verification for Part B

1. `npm run build --workspace=@routier/otel-plugin` succeeds (bundle + types).
2. `npm test --workspace=@routier/otel-plugin` — all pass.
3. `npm run lint --workspace=@routier/otel-plugin` — clean.
4. Full-repo test run still green: `npm test --workspaces --if-present` (or the repo's root test script — check root `package.json`). Known flake: S3 blob tests are known-flaky; a failure there alone is not caused by this work.

---

## Part C — Remove the old reflection-based logging

Do this LAST, after Parts A and B are green.

### C1. Delete these files/directories entirely

- `core/src/capabilities/` — the whole directory: `Capability.ts`, `PerformanceCapability.ts`, `TracingCapability.ts`, `types.ts`, `index.ts`, `performance/PerformanceTracker.ts`, `tracing/CallTraceManager.ts`.

### C2. Remove every reference

1. `core/src/index.ts` — delete the line `export * from './capabilities';`.
2. `core/package.json` — delete the `"./capabilities"` entry from `exports` and the `"capabilities"` entry from `typesVersions` (around lines 73–76 and 116–117).
3. `plugins/memory/src/tests/comments.test.ts` — delete the import of `TracingCapability, PerformanceCapability` and delete the entire `it("performance timing", ...)` test (it only exercises the deleted classes). Keep every other test in the file.
4. Search for stragglers and fix any hit in source or hand-written docs:
   `grep -rn "PerformanceCapability\|TracingCapability\|CallTraceManager\|PerformanceTracker\|from './capabilities'\|@routier/core/capabilities" --include="*.ts" --include="*.md" . | grep -v node_modules | grep -v dist | grep -v docs/reference`
   Expected remaining hits after your edits: none (generated files under `docs/reference/api` and `docs/.vitepress/dist` are handled next).
5. Regenerate the typedoc API reference so the generated pages for the deleted classes disappear: run `npm run typedoc` at the root, then check `docs/reference/api/core/src/classes/` no longer contains `PerformanceCapability.md`, `TracingCapability.md`, `Capability.md`. Delete them manually if typedoc does not clean stale files. Do NOT hand-edit anything else under `docs/reference/` — it is generated. Do NOT touch `docs/.vitepress/dist` — it is build output.
6. Do NOT delete `core/src/utilities/logger.ts` or `core/src/utilities/stringifyObject`-related code — the logger is used by the new sink and stringify is used elsewhere.

### C3. Verification for Part C

1. `npx tsc --noEmit` for core and the full build: `npm run build --workspaces --if-present` (or the root build script) succeeds.
2. Full test run green (same command and S3-flake caveat as B6.4).
3. The grep in C2.4 returns nothing.

---

## Final acceptance checklist

Work is done only when ALL of these are true:

- [ ] `TelemetryDbPlugin`, `TelemetryEvent`, `TelemetrySink`, `loggerSink`, `collectingSink` are exported from `@routier/core` (via `plugins/index.ts`).
- [ ] `@routier/otel-plugin` builds, lints, and its unit + acceptance tests pass.
- [ ] Core unit tests, memory-plugin acceptance tests pass.
- [ ] Stryker run for `core/src/plugins/**` meets threshold; otel stryker area created and run (or its blocker documented under "## Implementation notes").
- [ ] `core/src/capabilities/` no longer exists; grep in C2.4 is clean; typedoc regenerated.
- [ ] Full workspace build + test green (S3 flake excepted).
- [ ] No new dependencies in `@routier/core`; no runtime dependencies in `@routier/otel-plugin`.

## Implementation notes

### The `core/src/plugins/**` stryker area was already below its threshold

`npx stryker run stryker/plugins.mjs` scores **43.17** against a break threshold of 85. That is
pre-existing, not a regression: `ConcurrencyDbPlugin.ts`, `DataTranslator.ts`, `TupleTranslator.ts`
and all three `wire/` files score 0.00, `EphemeralDataPlugin.ts` scores 12.18, and
`RetryDbPlugin.ts` scores 70.00. 1,104 of 2,583 mutants have no coverage at all, which is the
scoping problem `stryker.base.mjs` warns about in its header — the area's jest glob does not reach
the suites that exercise those files.

`TelemetryDbPlugin.ts` itself scores **87.88**, above the threshold, with zero uncovered mutants.
No mutant in it survives that a test could reasonably kill. The two `result.ok === "success"`
mutants are equivalent for every real result shape (a success envelope carries no `error`
property), and are killed by a test that hands the wrapper a success result carrying one anyway.

`stryker/otel.mjs` scores **100.00** on `plugins/otel/src/**`.

### `@opentelemetry/context-async-hooks` is a test-only dependency

`context.with` propagates nothing under the API's default no-op context manager, so the nesting
test would pass vacuously without a real one installed. The plugin has no runtime dependency on
it — only `OtelDbPlugin.test.ts` does.

### Two native bindings are missing from the committed lockfile

`npm run build` fails at `@routier/core` and again at `@routier/react` on this machine because
`package-lock.json` has no `node_modules/@rspack/binding-darwin-arm64` or
`node_modules/@rollup/rollup-darwin-arm64` entry. This predates this work — `@routier/dexie-plugin`
fails identically on `main`. Both were installed by hand to verify the builds.

### `release-packages.mjs` now lists `plugins/otel`

Added so the new public package is covered by the release and README validation scripts. Both pass.
`release:pack-check` reports `README.md is not committed` / `LICENSE is not committed` for it until
the new files are committed.
