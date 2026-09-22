# Feature ideas

Candidate features, plugins, and adoption work for Routier. Nothing here is committed work.

Date: 2026-09-18.

Routier sits above an ORM — it orchestrates storage rather than replacing it — so most of what
ORMs ship is already here. This list was made by checking the repository first, and it only
covers things that could not be found in the code, docs, or specs.

## Already built, and ruled out

Caching, retry, optimistic concurrency, batching, telemetry and OpenTelemetry, encryption, blob
and S3 storage, soft delete, audit, vector search, full-text search, D1, Turso, MongoDB, HTTP
and stale-while-revalidate replication, React 19 Suspense reads, and Standard Schema interop
with Zod. Multi-tenancy was deliberately closed without building (see
`specs/plugin-roadmap.md`).

## Tier 1: gaps that block adoption

### 1. Schema migrations

This is the biggest hole.

- **Current state:** the docs list "No automatic schema migration" as a constraint for Postgres
  and MySQL. Dexie makes you bump `version` by hand, and a layout mismatch is an error. There is
  an `examples/db-migration`, but nothing shipped.
- **What evaluators expect:** Prisma, Drizzle, TypeORM and EF all have migrations, so this is
  the first thing someone comparing tools looks for.
- **Proposal:** Routier already holds the compiled schema and its hash, so it can diff two
  schema versions into a backend-agnostic change list: add property, rename, add index,
  backfill. Each SQL dialect then renders that list to DDL, and IndexedDB backends render it as
  an upgrade function.
- **Packaging:** a `routier migrate generate|apply|status` CLI covers servers, and a
  `.migrations([...])` declaration covers client stores that upgrade on open.
- **Local-first data transforms:** these matter even more here, because old clients hold
  old-shape rows that must be upgraded on open.

### 2. Devtools

None were found.

- **What to build:** a browser panel or embeddable `<RoutierDevtools />`. It would show
  collections, live subscriptions, pending change-tracker state, the sync outbox and dead
  letters, per-query timing, and `explain()` output.
- **Cost:** `TelemetryDbPlugin` already emits the events, so this is mostly UI.
- **Why it matters:** TanStack Query's and Redux's devtools drove much of their adoption, and a
  panel like this makes an orchestrator's behavior visible to someone evaluating it.

### 3. Relations and eager loading

- **Current state:** joins exist, but they are two collections only, return `[a, b]` pairs, and
  have no subscriptions and no `groupJoin`.
- **What ORM users expect:** to declare a relation once (`s.hasMany(posts, "authorId")`) and
  write `.include(u => u.posts)` to get nested objects.
- **Implementation:** this compiles down to the existing join (or a batched `IN` query) plus a
  stitching step.
- **Live joins:** a live query over a join or include is the differentiator here. Subscribe to
  both collections and re-run. Prisma and Drizzle cannot do this.

### 4. Realtime push for sync

- **Current state:** `sync-server` and the replication plugin are HTTP request/response with
  pacing. No WebSocket, Server-Sent Events (SSE), or long-poll transport was found.
- **Why it matters:** local-first users expect server changes to arrive without polling.
- **Proposal:** add a change-feed endpoint on the sync server using SSE, which is simplest and
  works on Cloudflare Workers, plus a client subscriber that feeds `PluginSyncEngine`. This
  fits with the D1/Workers work, where Durable Objects with WebSocket hibernation are the
  natural way to fan changes out.

## Tier 2: strong differentiators

### 5. More framework adapters

- **Current state:** only React and Vue.
- **Proposal:** Svelte (a store or runes), Solid (a signal) and Angular (a signal or
  Observable) are each about the size of `vue/src`. Each one opens a new community.
- **TanStack Query bridge:** also add a `queryOptions` helper so teams can adopt Routier
  without dropping their existing cache layer.

### 6. SSR and hydration

- **Proposal:** `dehydrate(store)` on the server and `hydrate()` into a `MemoryPlugin` or
  `OptimisticUpdatesDbPlugin` on the client, with guides for Next.js, Nuxt and SvelteKit.
- **Why it matters:** "does it work with Next App Router?" is an early evaluation question.

### 7. Conflict resolution strategies

- **Current state:** `docs/guides/local-first-apps.md` says "Routier does not provide an
  automatic CRDT or business-level merge policy."
- **Proposal:** ship the common strategies as a collection declaration:
  `.conflicts("last-write-wins" | "field-merge" | fn)`. Field-level three-way merge is cheap,
  because the change tracker already holds previous values.
- **Optional extra:** an `s.crdt()` property type backed by Yjs or Automerge for collaborative
  text.

### 8. Keyset (cursor) pagination

- **Current state:** the pagination docs mention no cursors, only skip/take.
- **Proposal:** `.after(cursor)` over a sorted query, pushed down as
  `WHERE (sort, id) > (?, ?)`. It stays stable under inserts and is O(1) at depth. It is also
  the right primitive for infinite-scroll live queries.

### 9. First-class upsert and bulk set operations

- **Current state:** upsert appears only in `specs/known-defects.md`, as inconsistent behavior:
  `MemoryPlugin` treats add as upsert, while Dexie's `bulkAdd` throws.
- **Proposal:** an explicit `upsertAsync` with pushdown (`ON CONFLICT`, `ON DUPLICATE KEY`,
  `put`).
- **Also:** query-scoped `updateWhere` and `removeWhere`, so a bulk change doesn't need to load
  rows first.

### 10. Undo/redo

- **Current state:** the change tracker already records previous values.
- **Proposal:** a `store.history.undo()` stack over committed saves. It is nearly free, demos
  well, and ORMs don't have it.

### 11. Sensitive fields

- **Current state:** encryption is declared per field as a schema transform, but nothing tells
  Routier's own outputs to hide a value. Logs, OpenTelemetry query text, `explain()` output, and
  dead-letter payloads can all carry it in plain text.
- **Proposal:** declare sensitive once in the schema, e.g. `s.string().sensitive()`, and have
  every Routier output redact it: the logger, errors, telemetry and OpenTelemetry attributes,
  `explain()`, dead letters, and the devtools panel (masked, click to reveal in development).
  The encryption transform marks its field sensitive automatically, so encrypted fields are
  never declared twice.
- **Also:** a read API such as `schema.sensitiveFields`, so apps can build their own data
  inventory for audits and erasure requests.
- **Ruled out:** a branded `Sensitive<string>` type. It stays assignable to `string`, so it stops
  no leak, and it adds friction to every consumer.

## Tier 3: cheap wins that fit the four shapes

Grouped by the extension points in `specs/plugin-roadmap.md`.

### Transforms

The roadmap already notes none of these need a plugin:

- compression
- PII redaction or tokenization
- a `@routier/transforms` package, so users don't write them by hand

### Wrappers

- `CircuitBreakerDbPlugin`: only 4 files mention a circuit breaker or rate limit.
- `ReadReplicaDbPlugin`: reads go to a replica and writes to the primary.
- `RateLimitDbPlugin`
- `OfflineQueueDbPlugin`, if the outbox in `HttpSwrDbPlugin` can be extracted.
- A cross-tab `CacheDbPlugin` invalidator over the existing broadcast work. It would fix the
  documented "cannot observe a write by another tab" caveat.

### Collection declarations

- `.ttl(ms)` for expiring rows
- `.validate(standardSchema)` on save
- `.rowLevel(ctx => filter)` as a documented authorization recipe on scopes
- `.seed()` for fixtures

### Backends

- Expo SQLite, op-sqlite and Capacitor as SQLite drivers, because React Native is a huge
  local-first audience. They slot in as drivers behind `SqliteDbPluginBase`.
- DuckDB-WASM for analytics.
- Redis/Upstash, DynamoDB, Supabase and Firestore.

### Introspection and codegen

- `routier pull` generates `s.define(...)` from an existing Postgres, MySQL or SQLite database,
  plus a Prisma-schema importer.
- Brownfield adoption is otherwise a rewrite.

### AI angle

- An MCP server exposing a store's schemas and queries.
- An embeddings transform that fills `s.vector()` automatically on save.

## Adoption work beyond features

- **Stale README.** The root one still says "Jekyll/Just the Docs" and "Node v16", and lists
  only 6 plugins. It undersells what exists.
- **`npm create routier`.** Templates for Vite+React, Next, Nuxt, Expo and a Cloudflare Worker
  + D1.
- **Migration guides.** "Coming from Dexie / RxDB / TanStack DB / Prisma / Redux", plus an
  honest comparison page. RxDB, TanStack DB, Zero, ElectricSQL and PowerSync are the real
  competitors, not ORMs.
- **Showcase app.** A multi-user, offline, realtime todo or kanban app that combines items 4
  and 7. That is the demo that sells local-first.

## Suggested order

Migrations, devtools, realtime push, relations and live joins, then adapters and SSR.
Migrations and relations answer the ORM checklist, and devtools and realtime are where an
orchestrator stands out.
