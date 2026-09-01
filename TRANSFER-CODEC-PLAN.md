# Plan: worker boundary transfer codec

Status: approved to build, 2026-08-25. This is the single source of truth. It absorbs the former
`TRANSFER-CODEC-PLAN-RECOMMENDATIONS.md` (now deleted) and four rounds of measurement.

This document is written to be implemented without further design decisions. Where a rule says
MUST or MUST NOT, deviation is a bug. Where a number appears, it was measured; the appendix says
how. If something here contradicts the code, stop and ask — do not improvise.

**Everything below section 0 is the document as approved on 2026-08-25 and has NOT been edited.**
Section 0 records where the built code deliberately differs from it. Where the two disagree, the
code is right and section 0 says why. The measurements are unaffected — no divergence changes the
wire format's costs.

## 0. Divergences from this document (updated as built)

All nine steps of section 12 are built and measured.

Beyond this document: `plugins/sqlite/src/drivers/wasmRaw.ts` reads column values through SQLite's
raw WASM exports instead of `Stmt.get`. That change is not in this plan and turned out to be worth
more than everything in it — see the measurements below.

**Placement (supersedes §4.1).** BOTH the codec and plan building are in `@routier/core`, not
split with `@routier/sql-plugin-core`. §4.1 justified the split by plan building needing
"`SchemaTypes` + the dialect's storage mapping" — but the mapping is a parameter, so that layer
knows no dialect, and `SchemaTypes` is a core type. Only `entityResultColumns` stayed in sql-core,
because "one column per nested subtree, named for its root" is a fact about flat tables. A
document or key-value store reuses everything else with no SQL dependency.

- `@routier/core/transfer` — the codec (`types`, `fillers`, `ChunkEncoder`, `decoder`) plus
  encoding policy (`plan.ts`).
- `@routier/core/plugins` — `ResultColumn`, `mappedResultColumns`. A result description is not a
  transfer idea, so it does not live under `transfer`.
- `@routier/sql-plugin-core` — `entityResultColumns` only.

**`SqlOperation` carries a result DESCRIPTION, not a plan (supersedes §6.1).** The field is
`result?: readonly ResultColumn[]`, and the encoding mapping is chosen by the DRIVER, not the
statement builder. §6.1's `result?: TransferPlan` made a statement builder pick a transfer
encoding on behalf of five drivers it knows nothing about, only one of which transfers anything.
A consumer composes: `buildTransferPlan(operation.result, mappingForMyEngine)`.

**`distinct` IS described (supersedes §6.2 and the §11 test).** `distinct` is not an aggregate
here — `buildFromQueryOperation` adds the keyword to the existing select list and returns whole
entity rows. §6.2's table lumped it with `count`/`sum`/`min`/`max`, whose exclusion is justified
by measurement on a one-row one-number result; that reasoning does not reach this case. The
aggregate four are excluded for a stronger reason than speed: they REPLACE the select list, so
reporting the projected columns would be a false description.

**Encodings name a value shape, never an engine (extends §5, §7.6).** Requiring the raw SQLite
shape silently disabled the codec for any engine that parses before returning — including PGlite,
this document's own consumer #2. `date-f64` now accepts a `Date`, an epoch number, or a string;
`boolean-byte` accepts a boolean or 0/1. New `json-stringify` encoding accepts a live object and
stringifies it in the worker, crossing the wire as an ordinary `json` column. Its benefit is
UNMEASURED and its doc comment says so.

**New extension points, not in this document.** `TransferEncodingStrategy` (a type table, a
per-column resolver, or both) so an engine whose answer is not a function of the schema type can
say so; `parsedValueTransferTypes` alongside `rawStorageTransferTypes`;
`ChunkEncoder.appendRecord` for an engine yielding name-keyed records rather than positional
tuples. `assertColumnLayout` is optional — an engine with heterogeneous records has nothing to
check against.

**§7.6's fallback drain was wrong for `date-f64`.** `Array.from(data.subarray(0, i))` yields epoch
NUMBERS, and the existing date deserializer converts only strings, so those rows would reach the
entity as numbers. The drain emits `Date` objects. Same class of bug in two more places, both
fixed: a `json` column drained a SQL NULL as the text `'null'`, and a `json-stringify` column
drained pre-fallback rows as text while post-fallback rows were objects.

**A column named `__proto__` lost its data, twice (not anticipated here).** Assigned onto a plain
object it reaches `Object.prototype`'s setter and never becomes an own property, vanishing when the
chunk is cloned; and quoted in a generated object literal it sets the row's prototype (Annex
B.3.1). Fixed with `Object.create(null)` for the chunk record, a computed key for that one name
(constant keys elsewhere — computed keys throughout measured 9% slower), and an own-property test
in the decoder's missing-column guard.

**§8.2's cache key quotes the name.** The plain `name + ':' + encoding` form collides when a name
contains `|` or `:`, and a collision hands a result the wrong compiled decoder silently.

**§3's `readRows` lives in its own module.** `wasmRows.ts`, so it is testable without loading the
WASM module — the same reason `wasmPool.ts` exists. The `get({})` overload was dropped from
`WasmStatement` rather than widened, since nothing calls it now.

### Measured on the real path (browser harness, headless Chromium, medians)

§1's table measured the BOUNDARY IN ISOLATION. On a real read it is one term of a sum, and the
numbers below are what a caller actually gets. `e2e/browser/transfer` reproduces all of it.

**Where a 4,000-row read's time went, before any of this work:**

| stage | cost |
|---|---|
| SQLite executing the query | 0.1ms |
| pulling values out through `Stmt.get` | 10.5ms |
| building row objects | 1.0ms |
| the `postMessage` itself | ~1.6ms |

The codec was aimed at the 1.6ms. That is why it returned 1.06-1.17x against §1's projected
1.47-2.00x — §13's second stop condition, hit squarely.

**The real cost was sqlite-wasm's `Stmt.get`**, which spends three WRAPPED WASM calls per value
(a redundant `sqlite3_column_count` to bounds-check, a `sqlite3_column_type` to sniff, then the
fetch), routes integers through `BigInt`, and decodes each text value separately. Reading the same
values through `wasm.exports` directly measured 3.2x faster with NULL handling included. See
`plugins/sqlite/src/drivers/wasmRaw.ts`.

**Read time, entity level, cumulative:**

| rows | original | + raw reader | + codec | total |
|---|---|---|---|---|
| 4,000 | 19.0ms | 11.4ms | 9.8ms | 1.9x |
| 20,000 | 104ms | 62.3ms | 46.1ms | 2.3x |
| 100,000 | 524ms | 319ms | 262ms | 2.0x |

**The codec's own contribution rose once extraction got cheap** — same code, larger share of a
smaller total: 1.14-1.16x at 4,000 rows, 1.29-1.35x at 20,000, 1.22-1.27x at 100,000.

**Small reads, averaged over hundreds of iterations:** the codec costs a flat ~55µs below about
100 rows (0.107ms against 0.053ms for a single row) and is ahead above it. Accepted as immaterial;
the fixed cost is most likely `ChunkEncoder` allocating full-size buffers for a short chunk.

**Main-thread blocking is NOT a differentiator.** §1's "first rows in ~2ms" implies the clone path
blocks and the coded path does not. Measured with a `MessageChannel` ticker, neither path produces
a single stretch over 16ms at any size, and the coded path's longest stretch is slightly LONGER
(7.6ms against 5.3ms at 100,000 rows) because decode runs synchronously per chunk.

**§8.4's CSP fallback is correct but unreachable.** Verified in isolation — under a policy without
`unsafe-eval` the codec reports itself unsupported, the encoder still works, and decode fails
loudly. But routier as a whole throws at import under that policy, because `schema.compile()`
generates functions. A CSP-restricted page cannot use the library at all, so the codec never gets
the chance to fall back. Pre-existing and unrelated to this work.

**§12 step 1 re-measured.** `get({})` against `get([])` on the real path: 19.6ms→11.6ms at 4,000
rows, 103.5ms→61.8ms at 20,000, 539.9ms→354.8ms at 100,000 — about 1.7x, the same order this
document claimed.

### A concurrency bug the example app found (unrelated to the codec)

`examples/finance-stress` now runs the same workload on every plugin (`?plugin=memory|sqlite|pglite`,
`?codec=off`), driven by `scenarios.mjs`. Under 10 concurrent writers SQLite lost money — $1,426 of
invariant drift and 34 failed saves with `cannot start a transaction within a transaction` — while
PGlite drifted $0.00 on identical work. NOT the codec: `codec=off` was worse.

**The WASM driver handed every caller a handle to ONE worker-held connection.** The plugin opens a
connection per operation, which gives every other driver an isolated transaction; here it gave N
handles to the same one. A save is `BEGIN IMMEDIATE`, statements, `COMMIT` — separate messages — so
two stores interleaved: the second `BEGIN` landed inside the first's transaction, and statements
were committed or rolled back with the wrong one.

Invisible to the whole test suite, because `node:sqlite` opens a real connection per operation and
a single store never contends. Fixed by serialising turns per database name in `drivers/wasm.ts`,
the same shape `pgliteDriver` already used — which is exactly why PGlite never had the bug. After
the fix all three plugins report $0.00 drift and no failed saves.

Consequence worth knowing: holding two connections to one database at once now waits forever. That
matches `pgliteDriver` and the open/use/close contract the plugin follows, and it caught a genuine
misuse in the browser harness.

### Follow-ups left open

Shipped on 2026-08-25 as core 0.6.0, sql-plugin-core 0.6.0, postgres-plugin-core 0.3.0,
sqlite-plugin 0.5.0 and pglite-plugin 0.3.0. What was deliberately not done:

- **`examples/db-migration` has no SQLite real-app check.** `@routier/sqlite-plugin` is not
  symlinked into `examples/node_modules`, so the SQLite side has no equivalent of the PGlite
  verification the console and finance-stress apps give. `finance-stress` covers SQLite through
  `?plugin=sqlite`, so this is a gap in breadth rather than an unverified plugin.
- **`finance-stress` reports throughput as numbers, not charts.** tx/sec, save p50/p95/p99,
  propagation and conflicts are all tracked and exposed on `window.__financeStress`; nothing plots
  them over time, which is what would make a regression visible at a glance.
- **`ChunkEncoder` allocates full-size buffers for a short chunk** — roughly 100KB to return one
  row, which is most of the flat ~55µs the codec costs below about 100 rows. Growable buffers
  would remove the only case where the codec is worse than doing nothing. Measured and accepted as
  immaterial; see the small-reads note above.
- **npm token deprecation** is tracked in `RELEASE-TODO.md`, not here.

### Step 9: PGlite (supersedes §4.1's consumer 2)

**Measured before building, and the answer differed from SQLite's.** PGlite's boundary is a real
share of a read, not a rounding error: 19-34% depending on size, against SQLite's 11%. So the codec
was worth adopting here for the reason it was not worth much there.

| rows | in page (no worker) | via PGlite's proxy | boundary | share |
|---|---|---|---|---|
| 1,000 | 5.8ms | 8.8ms | 3.0ms | 34% |
| 10,000 | 60.3ms | 74.5ms | 14.2ms | 19% |
| 50,000 | 301.3ms | 371.6ms | 70.3ms | 19% |

**Delivered, through the shipped plugin with `codec` on against off: 1.23x at 1,000 and 10,000
rows, entities identical.** It reclaims nearly the whole boundary — at 50,000 rows a prototype read
came back at 300.1ms against 294.4ms in-page, so crossing became close to free.

**The SQLite lever does not repeat.** `rowMode: 'array'` — the analogue of `get([])` — saves under
a few percent. PGlite's row materialisation is already efficient; there is no second 1.7x here.

**Leader/follower, and why no election code was needed.** §4.1 worried that adopting the codec
means "adding a routier-owned message channel that bypasses the proxy". It is narrower than that:

- After start-up, PGlite's own RPC moves entirely to a `BroadcastChannel`. A `BroadcastChannel`
  cannot transfer anything, which is exactly why the boundary costs what it does — and it leaves
  the worker's `postMessage` free. The two protocols share one worker without colliding.
- A worker that LOSES the election blocks before `init` and never constructs a database. So
  `serveCodedReads` finds nothing there, answers `unavailable`, and the driver latches over to the
  proxy — which reaches the leader the ordinary way. Multi-tab is unaffected and routier elects
  nothing itself.

`plugins/pglite/src/codedReads.ts` (worker), `codedReadChannel.ts` (main thread), and a
`codec?: boolean` plugin option mirroring the SQLite driver's. postgres-core carries the same
result description SQLite's does, retry included.

**Verified in the `examples/pglite-console` app**, which is the path a consumer takes and the one
the harness deliberately skips: Vite's own worker emission from `new Worker(new URL(...))`, the
published `dist` bundles, real OPFS. Seed, update, JSONB query and aggregate all pass with no
errors, data survives a reload, and hooking `Worker.prototype.postMessage` from outside the app
shows routier's tagged read traffic actually flowing — the coded path is engaged in the real build,
not just in the harness.

**A bundler trap worth remembering.** `plugins/pglite/package.json` sets `sideEffects: false`, so a
bundle whose entry is a side-effect-only import of the worker is tree-shaken to an EMPTY FILE. The
worker then loads without error and never answers PGlite's handshake, and the page hangs with
nothing reported anywhere. Build the worker as its own entry. The published rspack build already
does; this cost two silent timeouts in the harness before it was found.

## 1. What this is

The SQLite browser plugin runs its database in a worker because OPFS requires it
(`FileSystemFileHandle.createSyncAccessHandle` is undefined on the main thread). Query rows come
back through `postMessage` with no transfer list, so structured clone copies everything.

Two independent changes:

- **Step 1** — fix `readRows` in the worker. Stands alone, lands first, is worth more than the
  codec on its own.
- **Step 2** — a chunked hybrid transfer codec for query results. Measured end to end at
  **1.5x (4k rows) to 2.15x (500k rows)** against today, with first rows reaching the main
  thread in ~2ms at every size instead of after the full clone.

Final measured numbers (headless Chromium, medians, identical output verified by fingerprint):

| rows | today | codec (chunked + one-parse JSON) | speedup | first rows on main |
|---|---|---|---|---|
| 1 | 0.017ms | 0.034ms | 0.5x (costs 17µs) | — |
| 100 | 0.174ms | 0.141ms | 1.23x | — |
| 1,000 | 1.53ms | 1.10ms | 1.39x | — |
| 4,000 | 6.3ms | 4.3ms | 1.47x | 1.9ms |
| 20,000 | 30.4ms | 16.6ms | 1.83x | 2.2ms |
| 100,000 | 170ms | 85ms | 2.00x | 2.2ms |
| 500,000 | 887ms | 413ms | 2.15x | 2.1ms |

The crossover is ~100 rows. Below it the codec costs tens of *microseconds* — accepted, do not
add a row-count threshold branch. Aggregates are the one true exception (section 6.2).

## 2. Scope

Only serialization and deserialization of query results across the worker boundary.

**Explicitly out of scope**, accepted as known gaps:

- Injected values on `computed`, `function` and `transform` (the `injected?: I` argument).
- Computed properties capturing outer scope.
- Anything else a JSON round trip loses that encode/decode does not read.

**Decisions already made — do not reopen them:**

1. **No schema crosses the wire.** Do not call `SchemaDefinition.fromJson` in the worker. The
   worker gets a small data-only `TransferPlan` (section 5). Measured: the only variant needing a
   schema in the worker — shaping rows there and cloning them — LOSES 1.5-1.6x to today, because
   structured clone of `Date` objects and parsed JSON trees costs ~2.3x cloning the equivalent
   strings, and clone deserialization blocks the main thread anyway.
2. **Decode emits the FINAL entity shape** — `true`/`false` booleans, `Date` objects, parsed
   JSON — not the raw SQLite shape. Coded results bypass `decodeJsonColumns` and the translator's
   deserialize passes (section 9). Decoding to raw and re-shaping measured slower (156 vs 140ms
   at 100k).
3. **Dates cross as epoch milliseconds in a `Float64Array`**, not ISO strings. `Date.parse` in
   the worker, `new Date(epoch)` in the decode. Measured faster end to end because the final
   shape needs a `Date` either way and the ISO string then never crosses.
4. **JSON columns cross as text** and are parsed on the main thread — one `JSON.parse` per
   column per chunk (section 7.4). Parsing in the worker and cloning object trees measured
   38.5 vs 25.3ms at 20k rows.
5. **Plain strings always cross as strings in plain arrays.** Never `TextEncoder` them: 4k rows
   of 2KB text is 8.3ms cloned against 14.0ms packed; clone is a native memcpy over V8 strings.
6. **Integer policy**: routier only writes JS numbers, so `Float64Array` round-trips everything
   routier stored. sqlite-wasm can return a `bigint` for an externally-written value above 2^53.
   One `typeof value === 'bigint'` guard in the fill loop (section 7.6). No `BigInt64Array`.
7. **Results stream in fixed 4,096-row chunks** (section 7.1). The main thread decodes chunk *k*
   while the worker encodes chunk *k+1*. This is the single biggest win and it also removes the
   unknown-row-count problem (typed arrays are fixed size; each chunk is exactly sized).
8. **Grow-and-copy vs exact-size allocation does not matter** — measured within noise. Chunking
   makes the question moot. Do not add a COUNT(*) pre-query.
9. **Null-flags fast path** (skip bitmap tests for columns known non-null) measured ~3%. Not part
   of version 1. Do not build it.

## 3. Step 1: fix `readRows` (independent, land first)

`plugins/sqlite/src/drivers/wasmWorker.ts:138-146` currently calls `statement.get({})` per row,
which resolves column names on every row. Replace with:

```ts
const readRows = (statement: WasmStatement): unknown[] => {
    const rows: unknown[] = [];
    const names = statement.getColumnNames();

    while (statement.step()) {
        const values = statement.get([]);
        const row: Record<string, unknown> = {};

        for (let i = 0; i < names.length; i++) {
            row[names[i]] = values[i];
        }

        rows.push(row);
    }

    return rows;
};
```

The local `WasmStatement` type (`wasmWorker.ts:28-33`) declares only
`get(row: Record<string, unknown>)`. Widen it with `get(row: unknown[]): unknown[]` and
`getColumnNames(): string[]` — sqlite-wasm's `Stmt` provides both.

Measured: 37.6ms → 24.6ms for a real 4,000-row read; 636ms → 426ms at 64,000.

Tests: zero rows, column aliases, nulls, mixed scalar types, column ordering.

This fix still matters after step 2 for every statement that does not go through the codec.

## 4. Step 2 architecture overview

```
main thread                                    worker
-----------                                    ------
SQL builder produces sql + params
  + TransferPlan (from the select list
    and the schema's property types)
        |
        |  postMessage { kind:'all', sql,
        |    params, plan }
        v
                                               prepare, bind
                                               step 4,096 rows into typed
                                                 columns + string arrays
                                               postMessage(chunk, [transferables])
                                               ... keeps stepping next chunk ...
decode chunk k (generated function,
  emits final-shape row objects)
  while worker encodes chunk k+1
        |
                                               postMessage { last: true }
        v
rows: final routier entities
(bypasses decodeJsonColumns and
 translator deserialize)
```

### 4.1 Placement (decided 2026-08-25: core, three layers)

The codec is not SQLite-specific. PGlite is OPFS-in-a-worker for the identical reason
(`plugins/pglite/src/pgliteWorker.ts:4-6` — `createSyncAccessHandle` is main-thread-undefined),
and both plugins already share `@routier/sql-plugin-core`. Split by what each layer can know:

| layer | lives in | contains | knows about |
|---|---|---|---|
| codec | **core**: new `core/src/transfer/`, exported as `@routier/core/transfer` | the types of section 5; `ChunkEncoder` (bitmaps, validation, per-column fallback, chunk emission); the generated-decoder builder + LRU cache + CSP flag | nothing about SQL, schemas, or workers — it sees column values in, `{ payload, transferables }` out |
| plan building | **sql-core** (`@routier/sql-plugin-core`) | select-list → `TransferPlan` classification (section 6.3), taking a per-dialect raw-type mapping | `SchemaTypes` + the dialect's storage mapping |
| wiring | each plugin | worker protocol, `postMessage`, chunk accumulation, `decodeJsonColumns` bypass | its own engine |

Rules for the core module:

- NOT in `core/src/plugins/wire/` — that module's contract is deliberately plain JSON for
  crossing trust boundaries over HTTP, and transferables only work in-process.
- NOT schema-handler-shaped (`core/src/codegen/handlers/` builds per-entity handlers from a
  schema; a `TransferPlan` is a result shape, not a schema — joins, projections and `RETURNING`
  layouts have no schema). It reuses the same codegen *technique*, not the handler registry.
- The encoder must stay import-light: the worker file ships as its own bundle
  (`wasmWorker.ts:13-17`), so everything it pulls from core is bundled into it. No heavy core
  imports from the encoder path.
- Transport-neutral: the codec never calls `postMessage`. It returns `{ payload, transferables }`
  and the plugin posts it. A transport without a transfer list ignores the array and clones.
- Placement changes nothing about speed — same generated functions, same messages. The measured
  numbers in section 1 apply unchanged.

Consumers, in order:

1. SQLite WASM driver (this plan, step 2).
2. PGlite — **with a known caveat**: its worker RPC belongs to `@electric-sql/pglite/worker`,
   whose proxy structured-clones results inside a protocol routier does not own. Adopting the
   codec there means adding a routier-owned message channel in `pgliteWorker.ts` (the plugin
   already supports a custom `workerUrl`) that runs the query and the encoder inside the worker,
   bypassing the proxy for coded reads. That is its own piece of work — planned as a follow-up,
   not part of step 2. Note PGlite also returns *parsed* JS values (real booleans, dates), so its
   dialect mapping in sql-core differs from SQLite's raw TEXT/INTEGER/REAL shapes.
3. Any future OPFS-backed plugin (blob/file-system stores moving into workers) reuses the same
   core module; for raw bytes section 10 applies instead of the row codec.

## 5. Contracts (exact types)

```ts
/** How one result column crosses the boundary. */
export type TransferEncoding =
    | 'float64'       // Float64Array + null bitmap, transferred
    | 'date-f64'      // Date.parse in worker -> Float64Array epoch ms + null bitmap, transferred
    | 'boolean-byte'  // Uint8Array (0|1) + null bitmap, transferred; decode emits true/false
    | 'json'          // JSON text; texts joined into ONE document per chunk; decode JSON.parses once
    | 'clone';        // plain array of raw values, structured-cloned as-is

export type TransferColumn = {
    /** Exact name returned by SQLite, including projection and join aliases. */
    name: string;
    encoding: TransferEncoding;
};

export type TransferPlan = {
    version: 1;
    columns: readonly TransferColumn[];
};
```

The `version` covers the COMPLETE layout: chunk size, bitmap semantics, JSON joining, and the
message framing below. A decoder receiving any other version MUST throw
`new Error('transfer codec version X is not supported')` — never attempt to decode it.

Worker protocol additions (`plugins/sqlite/src/drivers/wasmWorker.ts:41-49`):

```ts
export type WorkerRequest =
    | { id: number; kind: 'open'; databaseName: string; storage: 'opfs' | 'memory' }
    | { id: number; kind: 'all'; databaseName: string; sql: string; params: unknown[]; plan?: TransferPlan }
    | { id: number; kind: 'run'; databaseName: string; sql: string; params: unknown[] }
    | { id: number; kind: 'delete'; databaseName: string; storage: 'opfs' | 'memory' };

export type EncodedChunk = {
    version: 1;
    rowCount: number;               // rows in THIS chunk; final chunk may be short; never 0 except a zero-row result's only chunk
    /** Keyed by column name. Exactly one entry per plan column. */
    columns: Record<string, EncodedColumn>;
};

export type EncodedColumn =
    | { encoding: 'float64'; data: Float64Array; nulls: Uint8Array }
    | { encoding: 'date-f64'; data: Float64Array; nulls: Uint8Array }
    | { encoding: 'boolean-byte'; data: Uint8Array; nulls: Uint8Array }
    | { encoding: 'json'; doc: string }        // '[' + rowTexts.join(',') + ']'; SQL NULL rows contribute the text 'null'
    | { encoding: 'clone'; data: unknown[] };

export type WorkerResponse =
    | { id: number; ok: true; rows?: unknown[] }                        // uncoded results, unchanged
    | { id: number; ok: true; chunk: EncodedChunk; last: boolean }      // coded results, 1..N messages
    | { id: number; ok: false; error: string };
```

Rules:

- Message order from one worker to one page is guaranteed by the platform; chunks arrive in
  order. The driver's pending-request map accumulates decoded rows until `last: true` resolves
  the request.
- An `{ ok: false }` arriving mid-stream MUST reject the request and discard partial chunks.
- The worker posts each chunk as
  `postMessage(response, transferables)` where `transferables` lists every typed array buffer in
  that chunk (`data` and `nulls` of every typed column). The transfer list is built separately
  from the payload — never embed the buffer list inside the payload as data.
- Transfer DETACHES the worker's copy. The worker MUST NOT touch a chunk's typed arrays after
  posting it. Each chunk allocates fresh arrays.
- A transport with no transfer list (e.g. `BroadcastChannel`) may ignore the list; the payload
  then clones correctly without it. Nothing in the format depends on transfer happening.

## 6. Building the plan (main thread, SQL builder)

### 6.1 Where

Extend `SqlOperation` (`plugins/sqlite/src/types.ts:3-8`):

```ts
export type SqlOperation = {
    sql: string,
    params: any[],
    conflictCheck?: { id: unknown },
    /** Ordered result columns for the transfer codec. Absent = clone the rows (today's path). */
    result?: TransferPlan,
};
```

The builder that emits the select list builds the plan beside it — the worker MUST NOT parse SQL
to recover the columns. Thread it through `runWithTable` (`plugins/sqlite/src/plugin.ts:140-157`)
and `SqliteConnection.all` (`plugins/sqlite/src/drivers/types.ts:19`) as an optional third
argument:

```ts
all(sql: string, params?: readonly unknown[], plan?: TransferPlan): Promise<unknown[]>;
```

Every non-WASM driver (`sqlite3.ts`, `nodeSqlite.ts`, `turso.ts`, the D1 path) ignores the third
argument entirely — zero behavior change. Only `drivers/wasm.ts:149` forwards it to the worker.
The missing-table retry (`plugin.ts:146-156`) passes the same plan on the retry — a retry MUST
NOT lose the plan.

### 6.2 Which statements get a plan

| statement | plan? |
|---|---|
| entity `SELECT` | yes |
| projection / subset select | yes, from its emitted select list |
| flattened join (`buildJoinStatement`) | yes, using the emitted aliases; decode happens BEFORE `splitJoinRows`, which then receives final-shaped flat rows |
| `INSERT/UPDATE/DELETE ... RETURNING` | yes |
| `count`, `sum`, `min`, `max`, `distinct` single column | **no — never** |
| DDL, transaction control | no (no rows) |

Aggregates are excluded by measurement, not caution: a one-row one-number result round-trips in
0.014ms cloned and 0.019ms typed. The codec can only lose there.

### 6.3 Choosing each column's encoding — conservative rules

Map from the schema property behind each select-list column:

| condition (checked in this order) | encoding |
|---|---|
| property has a custom `valueSerializer` or `valueDeserializer` or transform | `clone` |
| column is a SQL expression whose result type is not provable | `clone` |
| `SchemaTypes.Number` | `float64` |
| `SchemaTypes.Boolean` | `boolean-byte` |
| `SchemaTypes.Date` | `date-f64` |
| `SchemaTypes.Object`, `Array`, `Vector` | `json` |
| `SchemaTypes.String`, `File` (stored shape is a small reference object serialized to TEXT) | `clone` |
| anything else / unknown | `clone` |

A schema type alone does not prove the raw result type — custom serializers, migrations, and
external writers can put anything in a column. That is why the worker validates at fill time
(section 7.6) instead of trusting the plan.

Nullability: EVERY typed column gets a null bitmap, always. Do not infer null-freedom from the
schema — a `LEFT JOIN` produces NULL for non-nullable properties, and so do aggregates over
empty input and externally written rows.

## 7. Worker encode (exact algorithm)

### 7.1 Chunking

`const CHUNK_ROWS = 4096;` — measured best (8,192 within noise; 25,000 measurably worse).

```
prepare statement, bind params, names = getColumnNames()
verify: every plan column name exists in names, in the same order the plan lists them.
        Mismatch -> post { ok:false, error } and stop. Never decode against a wrong layout.
loop:
    fill one chunk by stepping up to CHUNK_ROWS rows (7.2-7.6)
    post it (last = statement exhausted)
until exhausted
finalize statement in a finally block (not finalizing holds a lock)
```

Zero rows: post exactly one chunk with `rowCount: 0`, zero-length arrays, empty `json` docs
(`'[]'`), and `last: true`. The decoder returns `[]`.

### 7.2 Null bitmap semantics (version 1, fixed)

- One `Uint8Array` of `ceil(rowCount / 8)` bytes per typed column, per chunk.
- Bit for row `i` (chunk-local index): byte `i >> 3`, mask `1 << (i & 7)` — LSB-first.
- **Set bit = SQL NULL.** The corresponding `data` slot MUST be written as `0`.
- Unused bits in the final byte MUST be zero.
- SQL NULL decodes to JavaScript `null` — never `undefined`, never an absent property. SQLite
  has one NULL; the row contract mirrors it.

### 7.3 Typed fills

Allocate `new Float64Array(CHUNK_ROWS)` / `new Uint8Array(CHUNK_ROWS)` per chunk. If the final
chunk is short, `subarray(0, rowCount)` is NOT enough — transfer moves the whole underlying
buffer — use `.slice(0, rowCount)` so the posted buffer is exactly sized.

- `float64`: `data[i] = value`
- `date-f64`: `data[i] = Date.parse(value)` (value is the ISO TEXT SQLite stored)
- `boolean-byte`: `data[i] = value` (SQLite stored 0 or 1)

### 7.4 JSON columns

Collect the raw TEXT of each row into an array; a SQL NULL contributes the four-character text
`'null'`. After the chunk's rows are stepped:

```ts
doc = '[' + texts.join(',') + ']';
```

This is valid because each element is already a complete JSON document (the plugin wrote it with
`JSON.stringify`) and `null` is valid JSON. One main-thread `JSON.parse(doc)` replaces one parse
per row — measured ~16% of the total win, and it stacks with chunking.

If a row's text is NOT parseable JSON (pre-existing data written by something else), the joined
document would poison the whole chunk. The worker does not validate JSON (that would be a second
parse). Instead the DECODER catches the `JSON.parse` failure for the chunk and falls back for
that column to splitting on the collected per-row texts — see 8.3. To make that possible the
encoder also keeps the rule: `json` texts MUST be joined with a single `','` and nothing else.

### 7.5 `clone` columns

Push raw values into a plain array, untouched. Strings stay strings.

### 7.6 Runtime validation (the bigint/wrong-type guard)

Inside the fill loop, before writing to a typed slot:

```ts
if (value === null || value === undefined) { /* set null bit, data[i] = 0 */ }
else if (typeof value === 'number') { data[i] = value; }
else { columnFellBack = true; /* switch this column to clone for the REST of the result */ }
```

For `date-f64` the accepted type is `string` (fed to `Date.parse`; a `NaN` result also triggers
fallback). For `boolean-byte` accepted values are the numbers 0 and 1.

Column fallback procedure (deterministic, no re-stepping — SQLite statements cannot rewind):

1. The column's already-filled typed values for THIS chunk are copied into a plain array
   (`Array.from(data.subarray(0, i))`, with nulls restored from the bitmap), the offending raw
   value is appended, and the column continues as `clone` for this chunk and every later chunk.
2. The chunk posts that column as `{ encoding: 'clone', data }`. The decoder reads each column's
   posted `encoding` tag, not the plan's, so no coordination message is needed.
3. Decode of a `clone`-fallback column emits the RAW value unchanged. The main thread then owes
   that column today's shaping (JSON parse / boolean / Date) — the driver routes fallback
   columns through the existing `decodeJsonColumns`/deserialize path for exactly those columns.

An unexpected value MUST NOT be silently coerced into a typed array. `NaN` and infinities in a
`float64` column are legitimate JS numbers and pass through as-is.

## 8. Main-thread decode

### 8.1 Generated, not reflective

A per-row loop that branches on column descriptors and assigns `row[c.name] = ...` onto a fresh
object builds dictionary-mode objects — measured 2.3-4x slower than a generated function that
emits one object literal per row, and the difference is most of the win. This mirrors why
`clone`, `hash` and `compare` are generated (`core/src/codegen/handlers/`).

The generator receives the plan (plus the actual per-chunk encoding tags for fallback columns)
and produces with `new Function` a decoder shaped like:

```ts
// generated for plan: id float64, isActive boolean-byte, createdAt date-f64, name clone, meta json
function decodeChunk(chunk) {
    const n = chunk.rowCount;
    const rows = new Array(n);
    const c_id = chunk.columns.id, c_act = chunk.columns.isActive,
          c_cre = chunk.columns.createdAt, c_name = chunk.columns.name;
    const meta = JSON.parse(chunk.columns.meta.doc);   // one parse per json column per chunk
    for (let i = 0; i < n; i++) {
        const byte = i >> 3, bit = 1 << (i & 7);
        rows[i] = {
            id: (c_id.nulls[byte] & bit) !== 0 ? null : c_id.data[i],
            isActive: (c_act.nulls[byte] & bit) !== 0 ? null : c_act.data[i] !== 0,
            createdAt: (c_cre.nulls[byte] & bit) !== 0 ? null : new Date(c_cre.data[i]),
            name: c_name.data[i],
            meta: meta[i],
        };
    }
    return rows;
}
```

Property order in the emitted literal MUST match the plan's column order for every row, so all
rows share one hidden class.

### 8.2 Cache

- Key: the stable string `'v1|' + columns.map(c => c.name + ':' + c.encoding).join('|')` — the
  serialized plan IS the key. No hashing (a hash needs collision handling for no benefit).
- Content-keyed on purpose: collection name is NOT the key. A migration changes columns under
  the same name, one worker serves every database on the page, and joins/projections produce
  many shapes per collection.
- Bound it: `Map` used as LRU, capacity 64 entries (each entry retains a compiled function).
  On overflow delete the oldest (first) key.

### 8.3 Error handling in decode

- Unsupported `version`: throw, message names the version. No decoding attempt.
- `JSON.parse(doc)` failure on a `json` column: split `doc.slice(1, -1)` — NO. Splitting joined
  JSON on commas is not reliable (strings contain commas). Instead: fall back to parsing
  row-by-row is impossible from the joined doc, so the decoder rethrows a precise error naming
  the column, and the driver retries the whole request WITHOUT a plan (today's clone path).
  This is the correctness backstop for pre-existing non-JSON data; it costs one retry only when
  such data exists.
- Any thrown decode error: reject the pending request; discard prior chunks.

### 8.4 CSP fallback

`new Function` needs `unsafe-eval`. Core already relies on it
(`core/src/schema/utils/standardJsonSchema.ts:708`, documented in
`core/src/plugins/query/join.ts:284` and `core/src/expressions/evaluate.ts:27`).

At driver startup (first coded query), generation is attempted inside try/catch. If it throws
(CSP), set a `codecDisabled` flag on the driver; every subsequent request omits `plan`, so the
worker uses today's clone path. Do NOT build a reflective columnar decoder as the fallback — it
was never measured non-regressive end to end, and today's path is a known-good baseline. The CSP
path MUST have a test, not just a code path.

## 9. Integration: bypassing the old shaping

For coded results the decode already produced final-shaped rows. Therefore:

- `plugins/sqlite/src/plugin.ts:182` (and the equivalent call in `d1.ts` if/when D1 gets the
  codec — it does not in step 2) MUST NOT run `decodeJsonColumns` over coded results, EXCEPT for
  columns that fell back to `clone` at runtime (7.6) — those get the existing shaping, scoped to
  those columns.
- `SqlTranslator`'s `field.property.deserialize(...)` calls
  (`core/src/plugins/translators/SqlTranslator.ts:190`, `:223`) run only on group/map paths. For
  coded results these would double-convert (a `Date` fed to a Date deserializer). Coded queries
  that use group/map keep those columns on `clone` encoding in the plan builder (6.3 already
  routes anything uncertain to `clone`) — the simple rule: **a query whose translation calls
  `deserialize` gets `clone` for the affected fields**. When in doubt, `clone`; the codec still
  wins on the typed columns.
- Columns with a custom `valueDeserializer` were already `clone` by 6.3 and keep today's exact
  path, mirroring the existing guard in `decodeJsonColumns`
  (`plugins/sql-core/src/columns.ts:195-207`).

Version skew: the worker ships as its own bundle (`wasmWorker.ts:13-17` records that nesting
bundles already broke once). The `version` field on plan and chunk is the guard; both sides
reject versions they do not know, loudly (5).

## 10. Large binary values (related finding, no codec involved)

There is no BLOB column today (`plugins/sqlite/src/utils.ts:11-31` maps every type to
TEXT/INTEGER/REAL). If bytes ever cross this boundary:

| payload | clone | transfer | post `Blob` handle |
|---|---|---|---|
| 100 x 100KB | 7.5ms | 1.1ms | 0.1ms (+10.1ms when bytes are later read) |
| 20 x 1MB | 14.7ms | 1.5ms | 0.1ms (+7.1ms) |
| 5 x 10MB | 30.5ms | 3.6ms | 0.1ms (+7.8ms) |
| 1 x 50MB | 16.9ms | 3.6ms | 0.1ms (+7.5ms) |

Real OPFS, 10MB file: sync-read + transfer = 3.5ms total; posting the `File` object = 0.5ms plus
4.4ms only if the main thread reads the bytes.

Rules: consumer needs an `ArrayBuffer` → read in the worker, transfer the buffer (a `transfer`
argument on the existing `postMessage` at `wasmWorker.ts:238` — no codec, no plan). Consumer can
use a `Blob`/`File` (img src, download, IndexedDB) → post the handle; it is by-reference and
effectively free at any size. NEVER wrap bytes in `new Blob([bytes])` just to post them — the
construction itself copies (~10ms for 20MB).

## 11. Required tests

Correctness (all against fingerprint-identical expected rows):

- zero rows; exactly 1 row; 100 rows (below crossover); 4,095 / 4,096 / 4,097 rows (chunk
  boundaries); bitmap byte boundaries: 7, 8, 9, 15, 16, 17 rows
- null numeric, boolean, and date values; a column that is entirely null
- non-nullable schema properties made null by a `LEFT JOIN` and by an aggregate over empty input
- projections, reordered columns, aliases, renamed (`.from()`) storage columns
- joins with overlapping source column names; unmatched `LEFT JOIN` rows
- all aggregates (`count`, `sum`, `min`, `max`, `distinct`) — asserting they DO NOT get a plan
- every write `RETURNING` path
- custom serializer / `valueDeserializer` / transform columns — asserting they get `clone` and
  today's shaping
- unexpected SQLite text in a numeric column → runtime column fallback (7.6), rest of result intact
- `bigint` above 2^53 → column fallback; `NaN` and infinities pass through `float64`
- non-JSON text in a `json` column → decode error → automatic planless retry succeeds (8.3)
- unsupported codec version → loud error
- CSP: `new Function` blocked → `codecDisabled` → planless requests, correct rows
- plan cache: reuse across identical shapes, distinct keys for distinct shapes, LRU eviction at
  capacity, migration changing a column type produces a different key
- posting with and without a transfer list produces identical decoded rows
- worker buffers are detached after transfer (access throws / byteLength 0)
- missing-table retry preserves the plan
- error mid-stream rejects the request and discards partial chunks

## 12. Implementation sequence

1. Land Step 1 (`readRows`) alone, with its tests. Benchmark before/after on the real path.
2. Create `core/src/transfer/` with the types of section 5, the `ChunkEncoder` (section 7), and
   the generated-decoder builder + cache + CSP flag (section 8). Unit-test the codec in
   isolation — encode columnar values, decode, compare — with no SQL and no worker involved.
   Export as `@routier/core/transfer` following core's existing subpath-export pattern.
3. Build the plan construction (section 6.3) in sql-core, parameterized by a dialect raw-type
   mapping; unit-test plans for every statement shape (6.2) before any worker change.
4. Thread `plan?` through `runWithTable`, `SqliteConnection.all`, and the worker request —
   non-WASM drivers ignore it; assert zero behavior change there.
5. Wire the worker: run the encoder against the stepping statement, post chunks (section 7.1).
   Rebuild core before the plugin — plugin dists bundle core source.
6. Wire the driver: accumulate chunks, decode, bypass `decodeJsonColumns` per section 9.
7. Run the full test list (section 11).
8. Measure on the REAL read path (a `toArrayAsync` over a real collection, through SQLite
   stepping, decode, and translation) — not the harness. Hold the numbers against section 1's
   table.
9. Only after the SQLite path holds: PGlite adoption as its own follow-up (section 4.1 consumer
   2, with the worker-channel caveat).

## 13. Stop conditions

- Step 1 alone gets the read where it needs to be.
- The real-path measurement (step 9) comes in well under the harness numbers.
- Result metadata cannot be propagated without making the generic driver contract materially worse.
- Runtime validation/fallback removes the measured benefit.
- Supported CSP environments would need a path that regresses from today's clone.
- Correctness for serializers, transforms, nulls, or large integers would have to be weakened.

## Appendix: measurement history and harness

Four rounds, all headless Chromium (occluded-window throttling makes headed timing wrong),
medians, warmups discarded, all variants fingerprint-verified to produce identical rows.

- **Round 1 (invalid — do not reuse its numbers).** Fed the boundary `Date` objects and multi-MB
  blobs; neither crosses it (`plugins/sqlite/src/utils.ts:11-31` maps Date→TEXT, Boolean→INTEGER,
  Number→REAL, Vector→JSON text; no BLOB column; `SchemaTypes.File` stores a small reference
  object, `core/src/schema/types.ts:53-67`). Reported 2.1-2.3x. The general lesson recorded from
  it: check the storage type mapping BEFORE benchmarking a boundary.
- **Round 2.** Correct raw shape, measured to RAW rows only: hybrid 1.37-1.65x. Also: strings
  must never be encoded; columnar without transfer is a wash; codegen decode vs reflective is
  2.3-4x. An independent review recommended against building on these numbers; superseded by
  rounds 3-4.
- **Round 3.** Measured END TO END to the final entity shape. Killed worker-side shaping
  (1.5-1.6x LOSS), reversed the Date rule (epoch f64 wins), fixed decode target to final shape,
  eliminated schema transport.
- **Round 4.** Chunked pipelining (4,096 rows) + one-JSON.parse-per-column-per-chunk. Combined
  results are section 1's table. Exact-size vs grow-and-copy: noise. Null-flags fast path: ~3%.
  Small-N sweep: crossover ~100 rows, 1-row overhead 17µs, aggregates faster cloned
  (0.014 vs 0.019ms). Binary/OPFS matrix: section 10.

Harness: `scratchpad/bigbench/` — `worker.js` + `bench.html` + `run.mjs`
(`node run.mjs runScale | runFaster | runCombinedScale | runSmall | runBinary`; needs
`playwright-core`, symlinked `node_modules`). Real read-path context: the boundary is ~3.3ms of a
~24.6ms 4,000-row read after Step 1, so codec gains are real but Step 1 dominates at small sizes;
the codec's value grows with row count and in main-thread responsiveness (first rows at ~2ms).
