# Plugin roadmap

Candidate plugins, why each is worth building, and what is still undecided. Nothing here is
committed work. Items marked **needs design** have an open question that must be answered
before anyone writes code, and the question is stated rather than left to be rediscovered.

Date: 2026-08-07

## Two shapes, and why it matters which one you pick

Routier has two extension points, and they have very different leverage.

| Shape | What it is | Reach |
| --- | --- | --- |
| Backend | Implements `IDbPlugin` | One more place to store data |
| Wrapper | Wraps an `IDbPlugin` | Works with every backend at once |

There are nine backends. There are three wrappers: `ConcurrencyDbPlugin`,
`OptimisticUpdatesDbPlugin` and `BlobDbPlugin`. A wrapper written once multiplies across the
whole matrix, so prefer a wrapper whenever the feature is not about *where* bytes live.

Both wrappers that augment storage use the same technique: hand the inner plugin a view of the
compiled schema with synthetic properties appended. Read `ConcurrencyDbPlugin` before writing a
new one.

## Ready to build

### 1. Encryption wrapper

Encrypt field values before they reach the backend. One wrapper covers all nine.

`crypto.subtle` provides AES-GCM in Node and in browsers, which is the same reason the blob
plugin hashes with it: one implementation, no environment branch.

**The constraint that shapes the design.** An encrypted column cannot be range-queried, sorted,
or usefully indexed. Deterministic encryption restores equality matching and leaks the
distribution of values. So the API has to state what a field gives up:
`s.string().encrypted()` forfeits `where(x => x.ssn > …)`, and the plugin should reject such a
filter rather than return wrong rows.

Decide before building:

- Randomised (safe, equality impossible) or deterministic (equality works, leaks) — or per
  property.
- Where the key comes from, and how key rotation re-encrypts existing rows.
- Whether a filter touching an encrypted property throws or falls back to in-memory evaluation.
  Falling back silently turns a bounded query into a full scan.

Effort: medium. Highest breadth of anything on this list.

### 2. Vectors and embeddings

`s.vector(1536)` alongside `s.file()`. Together they complete the shape an AI application
needs: bytes in blob storage, metadata in a database, an embedding beside the metadata, and one
query over all three.

pgvector reuses `@routier/sql-plugin-core` and the PostgreSQL plugin. `s.file()` established
how to add a schema primitive, so the expensive part is already paid: a tenth `SchemaTypes`
member, its codegen handlers, and the inference rules.

Decide before building:

- Which index type to declare (HNSW or IVFFlat) and where that declaration lives.
- What a similarity search looks like in the query API. It is an ordering, not a filter:
  `.nearest(embedding, 10)` returns the closest rows rather than the matching ones.
- Whether distance is exposed on the result, and how, given the entity shape is fixed.
- Backends with no vector support: SQLite has `sqlite-vec`, and Dexie has nothing. Say so.

Effort: medium. Highest differentiation. No TypeScript ORM covers files, metadata and vectors
coherently today.

### 3. Cloudflare D1 and Turso

Both are SQLite reached over HTTP.

Probably **drivers, not plugins**. `SqliteDriver` is four operations — `all`, `run`, `close`,
`deleteDatabase` — and `sql-core` already builds the statements. If the interface holds, edge
deployment becomes a configuration change rather than a port.

Spike it before planning it. The thing that could break the assumption is D1's batch API and
its transaction semantics, which are not SQLite's.

Effort: small, if the spike holds. Verify first.

## Needs design

### 4. Full-text search — needs design

Real user need, and `sql-core` gives leverage across three engines. The blocker is not
implementation.

**The open question: cross-backend consistency is impossible.** Every other feature in this
repository returns the same answer on every backend, and `e2e/src/dialectConformance.test.ts`
holds that line. Full-text search cannot meet it. SQLite FTS5, PostgreSQL `tsvector` and MySQL
`FULLTEXT` tokenise differently, stem differently, and rank differently. The same query over
the same rows returns different results, in a different order, on each.

So the first decision is what to promise:

- One engine only, and say the feature is PostgreSQL-only.
- A shared subset with results that differ per backend, documented loudly.
- A search-service wrapper (Meilisearch, Typesense) that is consistent because it is one
  engine, at the cost of a second system to run.

Also unresolved:

- FTS5 needs a shadow virtual table kept in sync by triggers. That is schema migration, which
  every SQL plugin explicitly does not do.
- Where search is declared: on the property (`s.string().searchable()`) or at the query.
- Whether relevance ranking is exposed. Ordering by rank is a query shape the translator has
  no concept of.
- What backends with no full-text support do. Falling back to `LIKE` returns different rows and
  would be the wrong kind of quiet.

### 5. Multi-tenancy wrapper — needs design

Scope every read and stamp every write with a tenant id. A wrapper enforces globally what is
easy to forget in one query and severe when you do.

**The open question: what makes it trustworthy.** A multi-tenancy layer that is 99% correct is
worse than none, because it is believed. The design has to make an unscoped query *impossible*,
not merely unlikely, and that has to be provable by a test rather than by review.

Decide before building:

- **Isolation model.** A `tenantId` column on every row, a database per tenant, or a PostgreSQL
  schema per tenant. Three different implementations with different blast radii; the wrapper
  can only be one of them.
- **Where the tenant comes from.** An ambient context works in Node through
  `AsyncLocalStorage` and has no browser equivalent. A per-store tenant is explicit and safe
  but means one store per tenant. A per-query tenant is the easiest to forget.
- **Coverage beyond `where`.** Counts, aggregates, `firstOrUndefined`, and every path in
  `bulkPersist` all need scoping. Any one missed is a leak.
- **The admin escape hatch.** Cross-tenant access is a real requirement and is exactly how
  leaks happen. It must be loud, separate, and impossible to reach by accident.
- **How the guarantee is tested.** Probably a property test that runs every query shape the
  oracle knows about against a two-tenant store and asserts no row crosses. Without something
  of that strength the feature should not ship.

## Small wrappers

Each is a few hundred lines and composes with every backend.

| Wrapper | What it does | Note |
| --- | --- | --- |
| Soft delete | Turns a remove into a flag, filters it from reads | Same coverage problem as multi-tenancy, smaller stakes |
| Audit log | Records who changed what, and when | The change tracker already computes the diff |
| Read-through cache | An LRU in front of a slow backend | Invalidation is the whole problem |
| Retry | Backs off on a transient failure | Only safe for idempotent operations; reads yes, writes need care |

## Backends

### MongoDB

The largest single gap. Genuine work rather than a driver: the query model has to translate to
MQL, which is a project on the scale of `sql-core`.

Worth doing for reach. Not worth doing before the wrappers above, which each deliver more per
line of code.

### Others, in rough order of value

SQL Server and DuckDB both reuse `sql-core`. Supabase is PostgreSQL over HTTP and may reduce to
a driver, like D1.

## Considered and rejected

Recorded so the reasoning is not repeated.

**DynamoDB as a general backend.** Its access model cannot honour the promises the query API
makes. Anything not served by a partition or sort key is a scan, so a plugin would pass every
test and fail on the first access pattern nobody indexed. This is the same trap as treating S3
as a database, which the blob plugin exists to avoid. A constrained key-value plugin that
refuses arbitrary filters would be honest; a general one would not.

**Redis as primary storage.** Wrong shape for a store of record. It belongs behind the
read-through cache wrapper above.

## See also

- `specs/core-agnosticism.md` — what a plugin may and may not assume
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the schema-augmentation technique
- `plugins/blob/README.md` — a worked example of a wrapper with a driver interface
- `plugins/sqlite/src/drivers/types.ts` — a worked example of a driver interface
