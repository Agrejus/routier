/**
 * The worker-boundary transfer codec.
 *
 * Not SQL-specific. Any plugin whose engine runs in a worker crosses this boundary for the same
 * reason — `FileSystemFileHandle.createSyncAccessHandle` is undefined on the main thread, so OPFS
 * persistence is only reachable from a worker — and pays the same structured clone for its records.
 * A document store, a key-value store, or anything else compiled to WASM over OPFS is the same
 * problem: many records, each a set of named values, crossing one `postMessage`.
 *
 * What an engine has to supply is small and deliberately so:
 *
 * - **An ordered list of the fields a result carries**, and the schema property behind each one
 *   where there is one. Positional (`appendRow`) or name-keyed (`appendRecord`), whichever the
 *   engine yields.
 * - **A `TransferEncodingStrategy`** — which encoding each field takes. A table by schema type
 *   covers the common case; a resolver covers an engine whose answer is not a function of the type.
 *
 * Every encoding names a VALUE shape rather than an engine, and the fillers accept every shape a
 * value plausibly arrives in: a date as a `Date`, an epoch number, or text; a boolean as a boolean
 * or as 0/1; a nested structure as text (`json`) or as a live object (`json-stringify`). An engine
 * chooses; nothing here assumes.
 *
 * Three layers, and the first two are here:
 *
 * - **codec** (`types`, `ChunkEncoder`, `decoder`) — column values in, `{ payload, transferables }`
 *   out. Knows nothing about schemas or workers.
 * - **plan building** (`plan`) — result columns become a `TransferPlan`. Needs `SchemaTypes` and a
 *   property's serializers, which are data-model facts, so it belongs here too. What varies by
 *   engine is only which values that engine hands back, and that is a `TransferTypeMapping` the
 *   caller passes in.
 * - **wiring** — the worker protocol and the transport. Belongs to each plugin.
 *
 * What is NOT here is anything that knows a STORAGE LAYOUT. `entityResultColumns` lives in
 * `@routier/sql-plugin-core` because "one JSON column per nested subtree, named for its root" is a
 * fact about flat tables, not about the data model.
 *
 * Deliberately NOT in `core/src/plugins/wire/`: that module's contract is plain JSON for crossing
 * a trust boundary over HTTP, and a transferable only moves in-process.
 *
 * The encoder is import-light on purpose — a worker file ships as its own bundle, so everything it
 * pulls from core is bundled into it. `plan` adds one runtime import, the `SchemaTypes` enum, whose
 * own module is type-only imports throughout.
 */
export * from './types';
export * from './ChunkEncoder';
export * from './decoder';
export * from './plan';
