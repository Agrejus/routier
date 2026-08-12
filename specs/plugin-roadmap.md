# Plugin roadmap

Candidate plugins, why each is worth building, and what is still undecided. Nothing here is
committed work. Items marked **needs design** have an open question that must be answered
before anyone writes code, and the question is stated rather than left to be rediscovered.

Date: 2026-08-07. Last updated 2026-08-12.

## Four shapes, and why it matters which one you pick

Routier has four extension points, and they have very different leverage. Reach for the
cheapest one that can express the feature.

| Shape | What it is | Costs | Reach |
| --- | --- | --- | --- |
| Backend | Implements `IDbPlugin` | A whole plugin | One more place to store data |
| Wrapper | Wraps an `IDbPlugin` | A few hundred lines | Every collection in the store |
| Collection declaration | A method on the collection builder | A few hundred lines | One collection, configured per collection |
| Transform | `to` / `from` on a property, declared in `.modify()` | Two functions | Every backend, with no plugin at all |

There are nine backends and five wrappers: `ConcurrencyDbPlugin`, `OptimisticUpdatesDbPlugin`,
`BlobDbPlugin`, `RetryDbPlugin` and `CacheDbPlugin`. Two collection declarations: `.softDelete()`
and `.audit()`.

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
  changed what. It needs to see the operation, which a transform never does. Then ask which
  collections: **all of them** → wrapper; **some of them, configured differently** →
  collection declaration.
- Intercepts **one property's value** → transform.

Encryption is the worked example for the transform row, and it is why this section says four
rather than three. It
shipped as a wrapper plugin, `.encrypted()` and all, and was then deleted: encryption is a
value mapping, so a transform expressed it in two functions and the whole plugin turned out to
be ceremony. The wrapper had to re-derive the schema for every backend and intercept both
paths to do the same job.

Candidates that are transform-shaped and therefore much cheaper than they look: compression,
tokenization and PII redaction, and any custom wire format. None of them need a plugin.

The trap in the other direction: soft delete, audit log, read-through cache, retry and
multi-tenancy all look like value features and are not. Each has to see the OPERATION, which a
transform never does.

But seeing the operation does not make something a wrapper — that is the second question, and
it is about SCOPE. A wrapper applies to the whole store. If the feature is a per-collection
decision, it belongs on the collection builder instead, where it can also be given
per-collection configuration a wrapper would have to fake. Soft delete and audit log both moved
there for exactly that reason; read-through cache and retry are genuinely store-wide and stayed
wrappers.

Reach for a collection declaration whenever "which collections?" has an answer other than
"all of them".

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

**Proven against a real binding**, unlike the Turso driver's HTTP transport.
`e2e/src/d1Miniflare.test.ts` runs the full plugin contract and the vector suite against D1
served by workerd through Miniflare — no Docker needed — and pins the three assumptions a
double could only have confirmed to their author:

- `batch()` is one transaction. A failure part way through leaves nothing behind, which is
  what the whole design rests on.
- Results come back positionally, one per statement, so the prepended creates can be sliced
  off and the rest matched to operations by index.
- A missing table says "no such table". D1 wraps it as
  `D1_ERROR: no such table: x: SQLITE_ERROR`; a wrapper that dropped the phrase would turn
  lazy creation into a hard failure on the first read of every collection.

Still untested: statement limits per batch, and behaviour against Cloudflare's own service
rather than workerd running the same code locally.

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

### Full-text search — shipped 2026-08-12

`s.string().searchable()`, `.fullTextSearch()` on the collection, `collection.search(...)`, and
`collection.fullTextSearch.check()` / `.rebuild()`. Full design and every decision in
`specs/full-text-search.md`; the user-facing page is
`docs/concepts/queries/full-text-search.md`.

**No plugin contains any search code**, which was the whole claim. Core tokenises and ranks; the
engine sees an ordinary `IN` over an ordinary table. One contract —
`describeFullTextSearch` in `@routier/test-utils` — runs against ten backends with no
exemptions.

Two things worth carrying forward from building it:

- **The prerequisite that disappeared.** This entry used to say full-text search depended on
  incremental `derive`, because a view is handed its whole snapshot on every save. Moving
  steady-state maintenance off the view and into the save pipeline, beside `.audit()`, removed
  the dependency entirely — and made the index commit in the same transaction as the documents,
  which the view could never do. A general incremental `derive` is still worth building; nothing
  waits on it.
- **Both remaining backend gaps were PLUGIN defects, not design limits.** `MongoDbPlugin`
  required `.identity()` on a key its own database does not require it on; `PouchDbPlugin` made
  its `_rev` write protocol every caller's problem instead of resolving it. Neither is search
  specific and both fixes help every user of those plugins. Worth expecting more of this: a
  feature that touches every backend is the thing that finds what one backend quietly demands.

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

## Closed without building

### Wrapper stacking order — closed 2026-08-12, no mechanism needed

This was recorded as an open design question: wrappers nest, the order is load-bearing, and
nothing errors when it is wrong. Four hazards were named. **None of them reproduce**, and the
entry is closed rather than deferred.

`datastore/src/collections/wrapperStacking.test.ts` covers five compositions and asserts on
`update.concurrency` — what a backend reads to decide whether to apply a write conditionally.
Absent means unconditional. Every one is checked, and a genuine conflict still throws.

Why each hazard is not live:

- **Cache above concurrency → unchecked writes.** Cannot happen, and the reason is structural
  rather than lucky. Wrappers nest, so a cache HIT is always preceded by a MISS through the same
  chain, and that miss is what observes the version. A `CacheDbPlugin` instance wraps exactly one
  inner plugin, so warming the cache warms the observer beneath it. There is no composition where
  the cache answers a read the observer never saw.
- **Cache below concurrency → token stripped before recording.** Defended by
  `CacheDbPlugin.rebuild`, which hands out a `structuredClone` on every read, so the observer's
  in-place strip lands on the copy. That clone was written to stop callers corrupting cached
  entries; the concurrency protection was an accidental side effect, and is now recorded at the
  site so nobody optimises it away.
- **Retry above anything not idempotent.** Solved inside `RetryDbPlugin`, which declines to retry
  `bulkPersist` and `destroy` outright. It stopped being a stacking concern whenever that landed.
- **A shared instance below a per-store wrapper.** Two stores sharing one `ConcurrencyDbPlugin`
  still produce checked writes. See the caveat below.

**The question this entry asked — who owns the ordering knowledge, given it cannot live on
`IDbPlugin` and cannot be a closed list — has no answer because it has no subject.** There is no
ordering constraint to encode. Do not build `composeDbPlugins`, a symbol-keyed placement
annotation, or a validation pass; each would guard a population of zero.

**One thing is NOT proven.** Every test reads before it writes. A store that updates a row it
never read at all, while sharing another store's observation map, would be the residual form of
the shared-instance hazard — it would write with a version it never observed. No attach-without-read
path was found in the API, so it may be unreachable, but that is untested rather than disproven.
Anyone adding such a path should extend that test file first.

## Needs design

### Multi-tenancy wrapper — needs design

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

## Small wrappers — shipped 2026-08-08

Three landed in core beside `ConcurrencyDbPlugin`; the fourth turned out not to be a wrapper
at all.

| Feature | Where | Note |
| --- | --- | --- |
| Retry | `RetryDbPlugin` | Reads only. A save is never repeated |
| Read-through cache | `CacheDbPlugin` | LRU, invalidated per schema on any write through it |
| Audit log | `.audit().derive()` on the collection builder | Not a wrapper — see below |
| Soft delete | `.softDelete()` on the collection builder | Not a wrapper — see below |

**Two of the four are collection declarations, not wrappers.** A wrapper applies to everything
a store does, and both of these are per-collection decisions: one collection wants it, the next
does not.

Soft delete declared on the builder also lets the CALLER pick the property, which a wrapper
appending a hidden column cannot. That matters because a deletion timestamp is not a token
nobody reads — it answers "when did this go?", and a hidden one makes that query unwritable.

Auditing shipped as a wrapper first and was replaced. The tell was in its own worked example:
the row mapper needed `if (change.collection === 'sessions') return null`, which is
per-collection configuration living inside a store-wide function. It now mirrors
`view().derive()` — `.audit(schema)` names what is written, `.derive((changes, cb) => ...)`
decides what goes in it — and `derive` receives the whole batch for one save rather than one
call per change, so a caller can collapse many edits into one row or emit none. There are no
return-value rules to learn.

What was given up is coverage: a newly added collection is unaudited until someone declares it.
A store-wide wrapper cannot miss one. That is the right trade here — the requirement was
history and logs with a caller-defined shape, not a compliance trail — but it is the reason to
think twice before doing the same to multi-tenancy, where the gap is invisible precisely
because the feature is believed.

Decided while building:

- **Retry never repeats a write.** A read is idempotent by construction, which is what makes a
  blanket retry safe and why the wrapper needs no transient-error classifier. A save gives no
  general way to know how much of it landed, and an add is the sharp case: the database assigns
  the identity, so a repeated INSERT does not collide, it DUPLICATES.
- **The cache rebuilds its value on every hit.** `TranslatedArrayValue.forEach` reassigns its
  own slots — that is how the change tracker swaps in attached entities — so sharing the
  cached instance would let one caller replace the cache's contents with its own proxies.
- **The cache invalidates before a write as well as after.** A backend without atomic batches
  can apply part of a failed save.
- **Audit rows ride the same save.** They are appended to the assembled `BulkPersistChanges`,
  so on a backend with an atomic batch the record and the change it describes commit together.
  A trail that can disagree with the data is worse than none, because it is believed.
- **Auditing runs after the prepare pipeline**, not inside a collection's own prepare. A
  declaration that ran there would see only part of the save, and what it saw would depend on
  the order collections happened to be declared in.
- **Audit rows are detached from the changes AND the result before anything else reads them.**
  Nothing tracks them, so a store that also declares a collection over the audit schema in
  order to read it would otherwise try to match rows its change tracker never sent — and the
  caller's reported add count would include rows they did not make.
- **Soft delete's scope uses loose equality**, or enabling it on an existing table whose rows
  predate the column would hide every one of them.
- **Soft delete branches on the collection's declared mode, not `Object.isFrozen`.** A row is
  frozen when READ, so a freshly added entity is not frozen yet and the assignment would
  succeed while an immutable collection recorded nothing at all.

What the cache cannot do is see a write it did not make. Another process, tab or store over the
same database leaves it stale until entries age out. That is the condition for using it rather
than a defect to fix later.

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
