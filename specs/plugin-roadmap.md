# Plugin roadmap

Candidate plugins, why each is worth building, and what is still undecided. Nothing here is
committed work. Items marked **needs design** have an open question that must be answered
before anyone writes code, and the question is stated rather than left to be rediscovered.

Date: 2026-08-07

## Three shapes, and why it matters which one you pick

Routier has three extension points, and they have very different leverage. Reach for the
cheapest one that can express the feature.

| Shape | What it is | Costs | Reach |
| --- | --- | --- | --- |
| Backend | Implements `IDbPlugin` | A whole plugin | One more place to store data |
| Wrapper | Wraps an `IDbPlugin` | A few hundred lines | Every backend at once |
| Transform | `to` / `from` on a property, declared in `.modify()` | Two functions | Every backend, with no plugin at all |

There are nine backends and three wrappers: `ConcurrencyDbPlugin`, `OptimisticUpdatesDbPlugin`
and `BlobDbPlugin`.

**Prefer a wrapper over a backend** whenever the feature is not about *where* bytes live. Both
wrappers that augment storage use the same technique: hand the inner plugin a view of the
compiled schema with synthetic properties appended. Read `ConcurrencyDbPlugin` before writing a
new one.

**Prefer a transform over a wrapper** whenever the feature is a per-property VALUE mapping. A
transform is `{ to, from }`, declared on the property and run by the datastore on the way out
and on the way back:

```ts
.modify(x => ({ notes: x.transform(cipher) }))
```

Nothing below the datastore learns it happened. A transform whose output type differs from the
property's declares `stores`, and plugins receive a schema view saying so — which is how each
still builds the right column, skips JSON encoding and indexes it correctly through unmodified
code. Core ships no transform of its own; what runs is whatever the caller supplied.

### How to tell which one you need

The question is *what the feature intercepts*.

- Intercepts **where bytes go** → backend.
- Intercepts a **query or a save** — scoping every read, filtering removed rows, recording who
  changed what → wrapper. It needs to see the operation, which a transform never does.
- Intercepts **one property's value** → transform.

Encryption is the worked example, and it is why this section says three rather than two. It
shipped as a wrapper plugin, `.encrypted()` and all, and was then deleted: encryption is a
value mapping, so a transform expressed it in two functions and the whole plugin turned out to
be ceremony. The wrapper had to re-derive the schema for every backend and intercept both
paths to do the same job.

Candidates that are transform-shaped and therefore much cheaper than they look: compression,
tokenization and PII redaction, and any custom wire format. None of them need a plugin.

The trap in the other direction: soft delete, audit log, read-through cache, retry and
multi-tenancy all look like value features and are not. Each has to see the operation, so each
is a wrapper.

## Built

### Encryption — shipped 2026-08-07, and it is NOT a wrapper

`@routier/encryption`. This section described a wrapper plugin declared with a core
`.encrypted()` modifier. Both are gone: `.encrypted()` was removed and the plugin with it.

Encryption is a **property transform**, supplied by the caller and declared in `.modify()`:

```ts
s.string().modify(x => x.transform(encrypted(keyring)))
```

The transform runs in the datastore, on the way out and on the way back, so nothing below it
knows encryption happened — no wrapper, and no plugin to write. A transform whose output type
differs from the property's declares `stores`, and plugins receive a schema view saying so,
which is how each still builds the right column and index through unmodified code.

Why this is better than the wrapper it replaced: a wrapper had to re-derive the schema for
every backend and intercept both the read and write paths. A transform is two functions
declared on one property, and it works everywhere because the datastore was always the layer
that owned the entity.

Keys live in a keyring with ids, so rotation adds a key rather than replacing one.

Answered as: caller-supplied transform rather than a plugin, key provider with ids, and a
filter over a randomised property is simply not pushed down.

### Vectors and embeddings — shipped 2026-08-07

`s.vector(1536)` and `.nearest(selector, vector, count)`. A tenth `SchemaTypes` member, one
query option, and pgvector pushdown in the PostgreSQL plugin.

**It works on every backend, and that is the design rather than a bonus.** A backend with a
native vector index does the search there; every other one stores the numbers as JSON and
scores in memory. Same rows, same order.

`describeVectorSearch` in `@routier/test-utils` holds that line. One set of expectations, run
against **every backend**: memory, Dexie, browser-storage, file-system, SQLite across all three
drivers, PouchDB, MySQL, MongoDB, and PostgreSQL both with and without pgvector — plus the
example plugin in `e2e/src/examplePlugin.test.ts`, which was written before vectors existed and
passes without a line added to it, because the scoring happens in the translator every plugin
inherits.

PostgreSQL is the only backend where a `<=>` ordering reaches the engine, and a column-type
assertion in `e2e/src/vectorSearch.test.ts` holds the two paths apart — otherwise a regression
that quietly stopped pushing down would pass by looking identical to the fallback.

It is a separate suite rather than a section of `describePluginContract` for a reason worth
keeping: the contract store declares a composite key, and PouchDB rejects a composite key for
the whole event rather than for that one collection. A backend that cannot run the contract
would have been silently exempt from the one claim this feature makes.

The seam that makes this cheap already existed: a plugin's translator decides per option
whether the backend did the work, which is how Dexie falls back on skip and take. `nearest` is
`abstract` on `DataTranslator` rather than a pass-through, so a new translator cannot be
written without answering for it — every other shaper degrades safely when ignored, and this
one returns rows in insertion order and calls them the nearest.

Decided while building:

- **Distance is not exposed.** The entity shape is fixed and the ordering is what callers act
  on. Adding it later is additive; taking it away would not be.
- **Cosine only.** Every text-embedding provider normalises for it, and a per-query metric
  that disagrees with an index's operator class silently drops to a sequential scan.
- **No index is declared, deliberately.** pgvector's HNSW and IVFFlat are APPROXIMATE, so an
  indexed search can return a different set of rows than exact scoring — which is the one
  thing this feature promises not to do. Exact `ORDER BY <=> LIMIT n` still avoids shipping
  every row to the client. Declaring an index means first deciding what to promise, and that
  is the full-text-search question in a different costume.
- **Everything after a `.nearest()` runs in memory.** Whether the search was pushed down is a
  fact about the plugin that `QueryOptionsCollection` cannot see, so a later option is only
  safe once the scoring has definitely happened. Without this, `.nearest(…, 10).take(3)` sends
  `LIMIT 3` to a backend that ignored the ordering and returns three real rows in a plausible
  order that are not the three nearest.
- **pgvector is probed, not configured.** The plugin asks the server once whether the
  extension is present or installable and caches the answer; a failure for any reason lands on
  the path that always works. The probe gates writes too, because it decides the column type
  the table is created with.
- **`dimensions` lives on `SchemaBase`, not `SchemaVector`.** A modifier wraps rather than
  extends, so `s.vector(1536).optional()` is a `SchemaOptional` and anything reachable only
  through the original class is lost. `innerSchema` is the cautionary example.

Known gap, and it is a migration rather than a bug: a table created as JSONB keeps that column
type if pgvector is installed later. No SQL plugin here migrates.

### Cloudflare D1 — shipped 2026-08-08, as a plugin variant

`D1DbPlugin` in `@routier/sqlite-plugin/d1`. The spike was right that this is not a driver: a
`SqliteDriver` exposes `run` and `all` against an open connection, and the plugin uses that to
hold a transaction open — BEGIN IMMEDIATE, a statement, a look at what came back, then the
next. D1 has no interactive transaction at all, so the interface a driver must implement is
not one D1 can offer.

What made it cheap anyway: the SQLite plugin already builds its whole `operations` list before
opening a connection. The statements were always batch-shaped; only the execution was not. So
the variant shares `utils.ts` — same DDL, same WHERE generation, same grouped updates — and
differs solely in how it hands them over. It lives in the SQLite package rather than a new one
because D1 IS SQLite, and a separate package could only get the builders by importing another
plugin, which the domain rules forbid and the "never duplicate a shared builder" rule exists
to prevent.

Both blockers resolved as the spike predicted:

- **Lazy table creation.** `CREATE TABLE IF NOT EXISTS` is prepended to the batch, deduplicated
  per collection. Idempotent, so it costs nothing and removes the interactive retry. Reads keep
  the retry — one statement, no transaction for a second attempt to break.
- **Optimistic concurrency: refused, loudly.** `ConcurrencyDbPlugin` wrapping `D1DbPlugin`
  throws on the FIRST operation, read or write. It cannot be refused in the constructor: a
  wrapper is invisible to the plugin it wraps until it hands down an augmented schema.

Decided while building:

- **The refusal covers reads too**, not just conflicting writes. The composition is wrong, and
  failing on the first query surfaces it in development rather than under contention.
- **`destroy` refuses without a caller-supplied `deleteDatabase`**, the same decision the Turso
  driver made. A binding cannot tell a scratch database from the production one an environment
  variable pointed it at.
- **Batch results are checked positionally.** A response shorter than the statement list throws
  rather than mis-filing rows into another schema's bucket, which would corrupt the change
  tracker's view of what was saved.
- **The `__version` check reads through `schemas.get(id)`, never by iterating.** Only `get` is
  augmented by the wrapper's proxy; iterating returns the raw schemas, so an iteration-based
  check finds nothing and the refusal never fires. It was written that way first.

Unproven, and the same shape of gap the Turso driver carries: the suite runs against a D1
double over `node:sqlite` that implements batch-as-transaction faithfully — rollback on first
failure, positional results, non-mutating `bind` — but nothing here has talked to Cloudflare.
That `batch()` really is one transaction on their side, how a missing table is reported, and
the statement limits are assumptions this encodes rather than facts it checks.

### MongoDB — shipped 2026-08-07

`@routier/mongodb-plugin`: `toMql` turns a core expression tree into an MQL filter document,
and `MongoDbPlugin` uses it for the query path, with `bulkPersist`, `_id`/`.identity()`
enforcement and a driver interface around `MongoClient`.

Translation took one file. The expression AST is far smaller than the backend entry below
assumed — 6 node types, 8 comparators, 2 operators, 3 transformers — and maps to MQL close to
one-to-one, with none of sql-core's DDL, column typing or dialect divergence to absorb.

Decided while building:

- **Operand order mirrors the comparator.** MQL has no `{ 5: { $lt: '$price' } }`; a field
  must be the key. `10 > x.price` therefore emits `{ price: { $lt: 10 } }`. This is the MQL
  form of the operand-order defect already recorded against the SQL equals path — ignore it
  and the query stays valid while returning the opposite rows.
- **Negation names the inverse operator** rather than wrapping in `$not`, because `$not` on a
  field predicate also matches documents where the field is missing. String patterns are the
  exception: no inverse exists, so they use `$not` over a `RegExp` instance.
- **Null follows Mongo, not SQL.** `{ f: null }` matches null and absent. The two readings
  agree for documents Routier wrote, since a schema serialises a nullable property explicitly.
- **`_id` is the caller's problem.** The eventual plugin will require the schema to declare
  `_id` as its key with `.identity()` and throw otherwise, rather than synthesising a mapping.
  Composite keys are excluded by that rule.

Verified by executing the output against MongoDB 7, not by asserting document shape — 27
filters over a seeded collection, checking matched ids.

### Turso / libSQL driver — shipped 2026-08-07

`tursoDriver` in `@routier/sqlite-plugin/drivers/turso`. A DRIVER, not a plugin — the spike's
hypothesis held. `sql-plugin-core` already builds every statement, so this only moves them.

It passes the full 62-test plugin contract, with exactly the same 8 skips as `node:sqlite` and
`sqlite3`. Identical results, which is the whole claim a driver interface makes.

**The part that is not a passthrough.** The plugin drives transactions the way every SQLite
engine expects — `BEGIN IMMEDIATE TRANSACTION`, statements, `COMMIT` or `ROLLBACK`, all through
`run` — because a local SQLite connection is stateful. libSQL over HTTP is not: each `execute`
is its own request, so a `BEGIN` sent that way opens a transaction the following statements
never join. The writes land outside it, commit individually, and the `ROLLBACK` undoes nothing.
Nothing errors; the database is simply inconsistent after a save fails half way.

So the driver recognises the three control statements and maps them onto
`client.transaction("write")`, routing everything else through the open transaction. Statement
classification is anchored on the first word, so `INSERT INTO commits ...` is not mistaken for
one.

Decided while building:

- **The client is passed in**, typed structurally, so `@libsql/client` is not a dependency of
  the plugin and the caller owns their connection and auth.
- **`deleteDatabase` refuses by default.** A libSQL database is provisioned out of band, and
  dropping a remote one from inside an application is destructive in a way the driver cannot
  scope. A caller who knows their URL supplies the teardown.
- **`"write"` rather than `"deferred"`**, matching `BEGIN IMMEDIATE`. Deferring moves a lock
  conflict from the BEGIN to a later statement, which is what defect #32 was about.

Two things still unproven, both worth knowing: the contract runs over a local `file:` URL, so
the HTTP transport — where the transaction mapping actually earns its keep — is untested, and
an interactive transaction holds a write lock with a **5-second timeout** that libSQL warns
degrades on high-latency or busy databases. A local file will never show either.

Follow-up worth considering: give `SqliteDriver` explicit transaction methods so transactions
stop being expressed as SQL at all. That removes the statement matching and matches what
`MongoDriver.transaction` already does. It changes the interface for three existing drivers,
so it was deliberately not bundled with adding a backend.

## Ready to build

### Vector follow-ups — optional speed, not capability

Vectors shipped (see "Built"). What remains is speed, and none of it changes what a caller
can do:

- **`sqlite-vec`.** Would push the search down on SQLite. Needs an extension loaded across
  three drivers that each load extensions differently, and Turso over HTTP may not at all.
- **An index for pgvector.** Requires deciding whether approximate results are acceptable —
  see the note above. Today's exact ordering is correct everywhere and slow only at scale.
- **A dimension check in core.** Currently the query vector is checked against the declared
  width at the `.nearest()` call, and stored values are checked only by backends with a
  native column. A JSON backend will store an embedding of the wrong width without complaint.

## Needs design

### 1. Full-text search — needs design

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

### 2. Multi-tenancy wrapper — needs design

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

### MongoDB — done, see "Built" above

The plugin shipped alongside its translator. This entry previously said "half done"; it is
not, and the list of what remained — `bulkPersist`, the query path, `_id`/`.identity()`
enforcement, pushdown wiring — is all present.

The trap this entry warned about was avoided: `MongoDbPlugin` translates filters with `toMql`
and hands the result to `collection.find()`, so a query is a query rather than a full scan
filtered in memory. That is the failure this document rejects DynamoDB for, and it is only
catchable by reading the plugin, since a scanning plugin passes every conformance test.

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
- `specs/domains.md` — what each part of the repository is responsible for, and the tests
  that enforce it
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the schema-augmentation technique
- `datastore/src/transforms/index.ts` — where a transform runs, and the schema view plugins see
- `plugins/encryption/README.md` — a worked example of a transform
- `plugins/blob/README.md` — a worked example of a wrapper with a driver interface
- `plugins/sqlite/src/drivers/types.ts` — a worked example of a driver interface
