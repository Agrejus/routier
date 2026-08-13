# Full-text search

Status: **BUILT.** All nine steps of the implementation order are complete, and every
prerequisite with them. Full-text search works on ten backends — memory, Dexie, file-system,
browser-storage, SQLite, PouchDB, Cloudflare D1, PostgreSQL, MySQL and MongoDB — against one
shared contract with no per-backend exemptions.
Date: 2026-08-10. Amended 2026-08-11. Completed 2026-08-12.

Two backend gaps found while proving guarantee 1 turned out to be plugin defects rather than
limits of this design, and both were fixed in the plugin: `MongoDbPlugin` required `.identity()`
on a key its own database does not require it on, and `PouchDbPlugin` made its `_rev` write
protocol every caller's problem instead of resolving it. Both fixes help every user of those
plugins, not only search.

Supersedes the "needs design" entry in `specs/plugin-roadmap.md`. Every previously open
question is now decided (decisions recorded 2026-08-10, with the user); an implementer should
never have to guess. Where this document and the code disagree about a mechanism it describes
(view reconciliation, builder staging, expression support), the code wins — but the DECISIONS
here stand until this file is amended.

Decision: the whole feature sits on top of the database, and the engine knows nothing about
it. Engine-native FTS (SQLite FTS5, PostgreSQL `tsvector`, MySQL `FULLTEXT`) is out
permanently — not deferred. See "Why the engine's own search is out" at the end.

## What is being built, in one paragraph

A collection can declare string properties searchable and opt into a search index. The index is
an ordinary generated collection — one row per (term, field, document) — so it needs no DDL, no
triggers, and no migration on any backend. Each save maintains it in the save pipeline, beside
`.audit()`, so index rows commit in the same transaction as the documents they describe; the
view mechanism (`datastore/src/views/View.ts`) builds and rebuilds it. Core tokenises both
documents and queries, so matching is set
membership and every backend returns the same rows in the same order. Search lives in the query
builder: `search()` starts a queryable that looks the query's terms up in the index (an
ordinary `includes` filter the expression pipeline already supports), joins to the source
collection, ranks by term frequency, exposes a readonly `score`, and composes with `where`,
`map`, `sort`, and `take` like any other query.

## Prerequisites, in build order

1. ~~**`s.string({ maxLength })`.**~~ **BUILT 2026-08-11.** Correction made while building:
   `s.string()` DID already take parameters — `string(...literals)`, which builds a literal
   union — so an options object could not replace that signature. It shipped as an overload,
   `s.string(options, ...literals)`, branching at runtime on whether the first argument is a
   string. Decision 2 stands: options object, not a `.maxLength()` modifier. `maxLength` lives
   on `SchemaBase` beside `dimensions`, for the reason documented there, and surfaces on
   `PropertyInfo`. MySQL emits `VARCHAR(maxLength)` and still defaults to `VARCHAR(255)`.
   Tests: `core/src/schema/stringMaxLength.test.ts`,
   `plugins/mysql/src/tests/columnLength.test.ts`. Like `s.vector(dimensions)`, it is a
   declaration core never validates — the backend that can use it does: MySQL maps a string
   with `maxLength: n` to `VARCHAR(n)` instead of the blanket `VARCHAR(255)`
   (`plugins/mysql/src/utils.ts`); every other backend ignores it. Useful independently of
   search (today every MySQL string column is silently `VARCHAR(255)`), and the generated index
   schema uses it to make the key-length budget explicit. Small enough to not need its own
   spec; this section is its spec.
2. **Joins** (`specs/joins.md`, now specified). `search()` is a query over the index
   collection joined to the source collection. Without joins, search would have to do the
   index→document hop in memory inside the datastore and could not honestly compose with
   `where`/`sort` — so joins land first, and search is a consumer of them. Search unblocks at
   step 5 of that spec's implementation order (the join option, the shared hash join, and the
   in-plugin interpretation) and benefits automatically from the semi-join prefilter (the
   index side is selective, which is exactly that optimization's case). It does not need
   native SQL joins.
3. ~~**Incremental derive**~~ — **discharged 2026-08-11, not skipped.** See the amendment
   below. Steady-state maintenance moved off the view and onto the save pipeline, where the
   change set is already incremental. The two modes still both exist and neither is
   user-selected: the INITIAL build of an index (first `.fullTextSearch()` on existing data, or a
   rebuild after a schema bump) is a full recompute through the view; steady-state maintenance
   on each save is incremental through the save pipeline. Which one runs is a fact about the
   situation, not a configuration. A general incremental `derive` remains worth building on its
   own merits; full-text search no longer waits for it.

## Guarantees this feature makes

These are the invariants the implementation must hold. Tests asserting each are listed under
"Acceptance tests" in the implementation order.

1. **Same answer everywhere.** The same corpus and the same query return the same documents in
   the same order on every plugin — Memory, Dexie, PouchDB, SQLite, D1, PostgreSQL, MySQL,
   MongoDB, file system, local storage. No plugin contains any search code; if a change to this
   feature touches a file under `plugins/`, the change is wrong.
2. **The index never lies.** The index reflects exactly the current documents: terms from
   deleted documents are gone, terms from edited fields are updated. As of the 2026-08-11
   amendment this is stronger than "after a save settles". Index rows ride the SAME
   `BulkPersistChanges` as the documents, so on any backend with an atomic batch the two commit
   together and no window exists in which they disagree. On the rebuild path, which writes
   through the view, the weaker settling guarantee applies.
   (This is why the index view must NOT use a computed key — see "The index collection".)
3. **Deterministic ordering.** Ranking has a total order: score descending, then source key
   ascending. Two runs never disagree.
4. **No plugin can break it.** The only per-backend constraint is MySQL's string-column length,
   and the token-length cap plus `maxLength` declarations keep every key under it by
   construction.

## Declaring what is searchable

A new modifier on `SchemaString`, following the existing `distinct()` / `index()` modifier
pattern (`core/src/schema/property/types/SchemaString.ts`,
`core/src/schema/property/modifiers/`):

```ts
const articleSchema = s.define('articles', {
    id: s.string().key().identity(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    authorNote: s.string(),          // not indexed
}).compile();
```

- `searchable()` is valid on `s.string()` only, including nullable/optional strings (a null or
  absent value simply contributes no tokens). It is NOT valid on numbers, dates, arrays,
  objects, or strings nested inside objects — v1 indexes root-level string properties only.
  **Built as (2026-08-11):** the builder does not offer the method where it would be invalid.
  Numbers, dates, arrays and objects are unreachable by type, through the wrappers as well as
  directly. Only nesting and the name-length budget throw when the schema compiles, because
  neither is expressible in the property's own type.
- The modifier must surface on `PropertyInfo` (e.g. an `isSearchable` flag) the same way
  `distinct` does, so the datastore can enumerate searchable properties of a compiled schema.
- Like `s.vector()`, the modifier exists to be RECOGNISED, not to behave: it changes nothing
  about storage, cloning, comparison, or serialization of the property.

## Opting the collection in

A builder stage on the collection, in both `CollectionBuilder` and
`ConfiguredCollectionBuilder` (the `audit()` precedent —
`datastore/src/collection-builder/CollectionBuilder.ts` declares it at both stages so it can
appear before or after the change-tracking mode):

```ts
articles = this.collection(articleSchema)
    .fullTextSearch({
        lowercase: true,        // default true
        minTokenLength: 2,      // default 2 — drops "a", "I" without a stop list
        maxTokenLength: 64,     // default 64 — longer tokens are TRUNCATED, not dropped
        stopWords: 'none',      // 'english' | string[] | 'none'; default 'none'
        tokenizer: undefined,   // (text: string) => string[]; replaces the entire pipeline
    })
    .proxy()
    .create();
```

Rules:

- Every option has a default; `.fullTextSearch()` with no argument is the whole opt-in.
- The schema says what COULD be indexed; the builder call says that it IS. If `.fullTextSearch()`
  is never called, no index exists and no write cost is paid, even when properties are marked
  searchable. If it IS called and the schema has zero searchable properties, throw at build
  time — an index over nothing is a declaration error, not an empty index.
- `.fullTextSearch()` may be called at most once per collection; a second call throws.
- If `tokenizer` is supplied, it replaces the whole built-in pipeline: `lowercase`,
  `minTokenLength`, `maxTokenLength`, and `stopWords` are ignored (throw if any is explicitly
  set alongside `tokenizer`, so the conflict is impossible to write). The same function is used
  verbatim for indexing and for queries. It must be pure and deterministic; that is documented,
  not enforced. Even with a custom tokenizer, emitted tokens longer than 255 characters are
  truncated to 255 — the MySQL key budget (below) is not the caller's to break.
- v1 requires the source collection to have a SINGLE key property of type string or number.
  `.fullTextSearch()` on a composite-key schema throws at build time with a message saying
  exactly that. (The index key embeds the source key; composite keys can be added later without
  changing any answer.) **Built as (2026-08-11):** string-or-number needs no check — the schema
  builder only offers `key()` on `SchemaString`, `SchemaNumber` and a computed constrained to
  `IdType`. A COMPUTED key is what compiles and cannot work, so that is what is rejected: a key
  derived from the entity changes when the entity does, stranding every index row that embedded
  the old one.

## The tokenizer

One pure function, new file `datastore/src/search/tokenize.ts`, used for both documents and
queries. Given a string and the options above, the default pipeline is, in order:

1. If `lowercase`, apply `String.prototype.toLowerCase()` (no locale argument — locale-sensitive
   casing would make the index machine-dependent).
2. Split on runs of characters that are not Unicode letters or digits: `/[^\p{L}\p{N}]+/u`.
   Empty strings from the split are discarded.
3. Drop tokens shorter than `minTokenLength`.
4. Truncate tokens longer than `maxTokenLength` to `maxTokenLength` (truncate, not drop — a
   250-character pasted URL should still be findable by its prefix).
5. Drop tokens in the stop-word set. `'english'` means exactly this 33-word list (the classic
   Lucene list), committed as a constant and treated as a compatibility surface — changing it
   changes what queries match, so it never changes silently:

   a, an, and, are, as, at, be, but, by, for, if, in, into, is, it, no, not, of, on, or, such,
   that, the, their, then, there, these, they, this, to, was, will, with

**Why stop words default to `'none'`.** The same tokenizer runs on both sides, so an enabled
list never causes a query/index mismatch — a word stripped from the index is stripped from the
query too. The default is off for two reasons. A stop list is language-specific: defaulting to
English silently eats words from non-English data. And stop words change what is findable at
all: with the list on, a search for "to be or not to be" has no tokens left and returns
nothing — acceptable when you chose it, baffling when you didn't. `minTokenLength: 2` already
removes the highest-noise tokens ("a", "I") with no language assumption, so dropping whole
words stays a deliberate opt-in.

There is NO stemmer. Shipping one puts a language's morphology in core and makes it a
compatibility surface. Anyone who wants stemming supplies a `tokenizer`.

Term frequency is computed by counting duplicate tokens per field after the pipeline runs.

## The index collection

A schema GENERATED at build time by `.fullTextSearch()` — the caller never writes it:

```ts
s.define(`${sourceSchema.collectionName}-search-index`, {
    key: s.string({ maxLength: 255 }).key(),  // `${term}|${field}|${sourceId}`
    term: s.string({ maxLength: 255 }).index(),
    field: s.string(),                        // source property name, for field-scoped search
    sourceId: s.string(),                     // or s.number() — copies the source key's type
    frequency: s.number(),                    // occurrences of term in that field
}).compile();
```

- **The key is a caller-supplied stable key, NOT `.computed()` and NOT `.identity()`.** This is
  load-bearing and easy to get wrong: `View.ts` decides whether a view accumulates history or
  mirrors its source by whether any id property is computed
  (`datastore/src/views/View.ts`, the `accumulates` flag). A computed key makes the view
  APPEND-ONLY — reconciliation skips removals — so an index keyed that way would keep terms
  from deleted documents forever, violating guarantee 2. The derive callback builds the key
  string itself; because the key is stable, the view mirrors, and rows whose (term, field,
  sourceId) no longer exists are removed by the ordinary reconcile diff.
- Key format `${term}|${field}|${sourceId}`: unambiguous because the default tokenizer cannot
  emit `|` (step 2 splits on it) and property names with `|` are rejected at schema compile
  (add that check if it does not exist). `sourceId` is `String(sourceKey)`.
- **Key length budget (the MySQL constraint):** `plugins/mysql/src/utils.ts` maps strings to
  `VARCHAR` columns, and this key is the primary key column, declared `maxLength: 255`. So:
  `maxTokenLength` (≤ 64 by default) + 1 + field name + 1 + source key length must stay ≤ 255.
  With a 64-char term cap, a 36-char UUID key, and sane property names, the budget holds with
  ~150 characters to spare. Enforce the only unbounded part: at build time, throw if any
  searchable property NAME is longer than 100 characters. Do not attempt to validate source key
  length (identity UUIDs are 36; a caller-supplied longer key will fail loudly on MySQL at
  write time, which is acceptable and documented).
- `term` carries `.index()` so backends that honour secondary indexes make the lookup fast;
  backends that ignore it are merely slower, never wrong.
- No positions column. Phrase and proximity search are out of scope for v1 (decision 3 below).

The index collection is registered with the store like any other collection, so every plugin
creates its table/object store through the machinery it already has (verified: the SQLite,
MySQL, and PostgreSQL plugins derive `CREATE TABLE IF NOT EXISTS` from the compiled schema on
first use; Memory/Dexie/PouchDB/Mongo create collections implicitly). **No plugin changes.**

## Amendment (2026-08-11): index maintenance moved to the save pipeline

The original plan maintained the index entirely through `View`. Steady-state maintenance now
runs in the save pipeline instead, the way `.audit()` does. The view keeps the rebuild path
only. This section records why, because the reasoning is the reason prerequisite 3 went away.

### What the view actually costs

Read `datastore/src/views/View.ts` before disputing this. On every source save the view:

1. Receives the ENTIRE source array. `DeriveCallback` takes `data[]` and nothing else
   (`datastore/src/views/types.ts:4`).
2. Re-tokenises every document, because it was handed every document.
3. Reads the ENTIRE index collection — `this.toArray(...)` at `View.ts:167`.
4. Hashes both sides into maps — `View.ts:189-197`.
5. Diffs, and writes only what changed.

Step 5 is already incremental. The view never rewrites the whole index. The cost is steps 1–4,
where the read and the compare scale with the corpus rather than with the change. Editing one
title in a corpus of 10,000 documents reads 10,000 documents, tokenises 10,000 documents, reads
every index row, and hashes both sides — to write about six rows. That cost is paid on every
save and it grows with corpus size.

The second problem decided it. The view writes AFTER the source save commits, in a separate
transaction (`View.ts:250`). A failed view write is a log line — `View.ts:259` — with no caller
to tell. For an index that means the document is saved, the index disagrees, and nothing
reports it.

### What replaces it

A registry beside `AuditRegistry`, at the same site in the save pipeline
(`datastore/src/DataStore.ts:291`, after the prepare pipeline so the batch is complete). It
receives the assembled adds, updates and removes for the source collection, and appends the
index rows it computes to the same `BulkPersistChanges`
(`datastore/src/collection-builder/audit.ts:107-155` is the working precedent).

Consequences, in the order they matter:

- Index rows commit in the same transaction as the documents. Guarantee 2 becomes true rather
  than eventually true, and a failure surfaces to the caller who saved.
- Maintenance sees only what changed. No corpus read, no whole-index read.
- No general incremental-derive mechanism is needed. The save pipeline hands over a change set
  that is already incremental.

Per changed document and searchable property: tokenise the value (null or undefined
contributes no tokens) and emit one index row per distinct (term, field) with its frequency and
the key built as above. Compute the rows to REMOVE from the previous value of the same property
(next section), and emit adds, updates and removes for that document alone.

### Previous values, and the one mode that lacks them

Removing stale terms needs the value a property held BEFORE the save. Without it, an edit from
"copper pipe" to "copper wire" cannot know that the `pipe` row must go. The change record
carries `delta`, and `delta` holds new values only — it is a flat partial entity
(`datastore/src/change-tracking/ImmutableUpdates.ts:16`).

Two of the three change-tracking modes already capture the previous value. They do not expose
it on the change record, which is the work:

| mode | where the previous value lives | work needed |
| --- | --- | --- |
| proxy | `__tracking__.original[path]`, written once on first change to a path (`core/src/schema/SchemaDefinition.ts:116`) | surface it |
| immutable | `PendingUpdate.original`, the whole pre-change entity (`ImmutableUpdates.ts:61`) | surface it |
| diff | nowhere — `snapshotHash` is a content HASH (`datastore/src/change-tracking/ChangeTracker.ts:170`) | capture it |

Diff tracking is the real gap. A hash says THAT an entity changed, not what it held. Diff mode
must retain a baseline of the previous values, not only the hash that detects dirtiness. Keep
the hash as the cheap dirty check; the baseline exists only to produce previous values.

Rules for the capture:

- Add `previous` beside `delta` on the change record handed to a save-pipeline participant
  (`AuditChange` in `datastore/src/collection-builder/audit.ts:44` is the type to extend). It
  holds the previous values of the changed properties, as a flat partial entity — the same
  shape as `delta`, so one consumer reads both.
- All three modes must produce the same shape. Proxy stores originals under resolved paths and
  immutable holds a whole entity; both normalise to a flat partial entity. v1 indexes
  root-level string properties only, so top-level properties are sufficient.
- Diff mode must not pay for a baseline nobody reads. Capture it only when the collection
  declares something that needs previous values, so an ordinary diff collection keeps its
  current memory cost.
- With `previous` available, steady-state maintenance performs NO reads. It stays synchronous
  and the pipeline needs no change. (`TrampolinePipeline`'s `Processor` is already
  `(data, callback) => void` and handles an async step — `core/src/pipeline/TrampolinePipeline.ts:9`
  — so an async participant remains possible if a later feature needs one.)

### What the view is still for

The INITIAL build and any rebuild after a generated-schema bump. That path reads all source
rows and reconciles the whole index, which is exactly what `View` does well and what steps 1–4
above cost too much to do on every save. Reuse `View` as-is or as a thin subclass; do not
reimplement reconciliation. The per-plugin write serialization (`viewWrites`), snapshot
coalescing, and disposal cancelling in-flight reconciles all apply on that path.

The index schema keeps a caller-supplied stable key for the same reason as before — a computed
key makes the view append-only and stale terms survive forever. See "The index collection".

## Querying

`search()` is part of the query builder, available only on collections that declared
`.fullTextSearch()` — use the existing `create(extend)` extension hook
(`ConfiguredCollectionBuilder.create`) so the returned collection type carries the method and
collections without an index do not have it (calling it there is a compile error, not a runtime
miss).

```ts
// all searchable fields
const hits = await store.articles
    .search('copper pipe')
    .where(x => x.published === true)
    .take(10)
    .toArrayAsync();

// scoped to one field (overload), OR-matching (option)
const loose = await store.articles
    .search(x => x.body, 'copper pipe', { match: 'any' })
    .toArrayAsync();
```

Overloads — field scoping is the leading argument, matching the old draft and `.nearest()`:

```ts
search(terms: string, options?: SearchOptions): SearchQueryable<TEntity>;
search(selector: (x) => string, terms: string, options?: SearchOptions): SearchQueryable<TEntity>;
search(selectors: Array<(x) => string>, terms: string, options?: SearchOptions): SearchQueryable<TEntity>;

type SearchOptions = { match?: 'all' | 'any' };   // default 'all'
```

Selectors resolve to property names the way `softDelete` resolves its selector; a selector
naming a non-searchable property throws.

Semantics, precisely:

1. Tokenise the query with the collection's own tokenizer config. Deduplicate tokens. If the
   result is empty (empty string, all stop words), the query returns `[]` — no tokens is no
   query.
2. Filter the index collection: `params.terms.includes(x.term)`, AND
   `params.fields.includes(x.field)` when a selector overload was used. The expression pipeline
   already parses params-array `includes` — see
   `core/src/expressions/parserExpandedSyntax.test.ts` — so this pushes down to every backend
   as an ordinary filter. This is the ONLY sense in which search "defers to the database": the
   engine narrows candidate rows through its normal query path without knowing they are a
   search index.
3. Group matched rows by `sourceId` and apply the match mode. `'all'` (default): keep only
   documents whose rows cover EVERY query token — each token found in at least one searched
   field. `'any'`: keep documents matching at least one token. Under `'any'`, documents
   matching more tokens naturally score higher; there is no other semantic difference.
4. Score each surviving document: sum of `frequency` over its matching rows. Default order is
   score descending, then source key ascending (numeric for number keys, code-unit
   lexicographic for strings).
5. Join to the source collection (prerequisite 2) to produce documents. The result shape is the
   entity plus a READONLY `score: number` — present by default, removable with `.map()`
   (the projection operator; there is no `.select()` in this codebase), never writable,
   never persisted. The score's numeric VALUE is not a compatibility surface;
   only the ordering is. (Ranking may improve in later versions — e.g. length normalisation —
   without that being a breaking change. Callers who persist or compare raw scores across
   versions are doing something the API does not promise.)

Composition: `where` and `map` compose as the joins spec defines for any joined query.
`sort` replaces the default rank order (rank order is the default `sort`, not a law); sorting
by `x.score` explicitly is allowed and equivalent to the default. `take`/`skip` apply after
ordering. Documents are read through the collection's normal read path, so soft-delete scopes
and `.scope()` filters apply — a soft-deleted document can appear in the index (the view sees
the raw table) but is filtered out at the join; that is correct behaviour.

## Decisions, recorded

1. **API shape: query-builder `search()`, built on joins.** Not a standalone
   `searchAsync` — search should feel like the rest of Routier. Joins are therefore a
   prerequisite, built first and consumed here.
2. **String max length: `s.string({ maxLength: n })`** — an optional options object on the
   existing factory, not a modifier method. Declaration only; MySQL uses it for `VARCHAR(n)`,
   others ignore it, core never validates (the `s.vector(dimensions)` precedent).
3. **Recompute: wait for incremental derive.** ~~Full recompute remains as the initial-build and
   rebuild path; incremental is steady state.~~ **Amended 2026-08-11.** Both modes still exist
   and neither is user-selected. Steady state no longer waits for incremental derive, because it
   no longer runs through the view — see the amendment. Full recompute stays the rebuild path.
4. **Match mode: both.** `match: 'all' | 'any'`, default `'all'`. AND is what a search box
   means; OR is one option away.
5. **Stop words: default `'none'`**, opt-in `'english'` or a custom list. Reasoning in the
   tokenizer section.
6. **Scores: exposed, readonly.** `.map()` removes it when unwanted. The value is not a
   compatibility surface; the ordering is.
7. **Replication: the index collection is excluded from sync.** The index is derived locally
   from source documents every client already has; a synced copy is a second writer fighting
   the local recompute on every cycle (and possibly built with a different tokenizer config).
   Excluding a collection from sync is existing replication configuration, not new machinery —
   this is a documentation requirement, not code.
8. **Field scoping: all searchable fields by default**, narrowed by the selector overloads.
9. **Ranking: term frequency only.** No BM25: it needs corpus-global aggregates (document
   count, per-term document frequency) that change on every save; maintaining them is a second
   index with a worse write pattern. TF-only is stated as a limit in the docs, not discovered
   as one. Exposing the score does not lock the formula in — see the query semantics.
10. **Phrase and proximity: out for v1** — both need token positions, which multiply index size
    by occurrences. The upgrade path is NOT a migration: the index is derived data, so adding a
    positions column later means bumping the generated schema and letting the view rebuild from
    an empty index. Say that in a comment where the index schema is generated.
11. **Index scope: one index per collection.** Cross-collection search is out of v1;
    per-collection does not preclude a shared index later.
12. **Write amplification: accepted and documented** — a 500-word document touches up to ~500
    index rows on first index and on edits of an indexed field (incremental derive bounds
    steady-state cost to the changed documents). Measure alongside `BatchingDbPlugin`
    (`specs/write-batching.md`) rather than guessing.
13. **Persistence: the index is persisted, always** (it is a collection; it lives where the
    store lives — which for `MemoryPlugin` already means in memory). A rebuild-on-start
    memory-only mode is a possible later option, not a v1 fork.
14. **Steady-state maintenance runs in the save pipeline, not the view (2026-08-11).** Three
    reasons, in the order they decided it: index rows commit in the same transaction as the
    documents, so the index cannot lie or fail silently; maintenance sees only what changed, so
    nothing scales with corpus size; and no general incremental-derive mechanism is needed. The
    view was the right instinct — it owns reconciliation, and it is how the rebuild path still
    works — but it is handed the whole world on every save and writes afterwards, which are
    exactly the two properties an index must not have. Recorded so the view is not reproposed
    for steady state.
15. **`previous` on the change record is part of this feature, and is general (2026-08-11).**
    Removing stale terms needs the value a property held before the save, and `delta` carries
    new values only. Proxy and immutable already capture it; diff keeps only a content hash and
    must start capturing. The capture is opt-in per collection, so diff tracking pays no memory
    for a baseline nobody reads. Nothing about `previous` is search-specific — an audit
    declaration wanting before-and-after gets it for free.

## Per-plugin audit (why no plugin can break this)

Recorded because it was asked directly: nothing in any backend prevents or degrades this
feature, and nothing in this feature touches a plugin (except the independent
`s.string({ maxLength })` mapping in the MySQL DDL generator, which is prerequisite 1, not
search code).

| plugin | index table creation | lookup (`includes` filter) | constraint |
| --- | --- | --- | --- |
| Memory | implicit | in-memory filter | none |
| Dexie / IndexedDB | schema known at store construction, like any collection | native or fallback filter | none |
| PouchDB / local storage | shared physical store + discriminator, as views already do | filter | none |
| SQLite / D1 | `CREATE TABLE IF NOT EXISTS` derived from schema on first use | SQL `IN` | none |
| PostgreSQL | same | SQL `IN` | none |
| MySQL | same | SQL `IN` | string PK length → key budget above |
| MongoDB | implicit collection | `$in` | none |
| file system / blob | same as any collection | filter | none |
| replication (`HttpDbPlugin` etc.) | n/a | n/a | index excluded from sync — decision 7 |

The dialect conformance suite (`e2e/src/dialectConformance.ts`) gets a search scenario so this
table is enforced, not asserted.

## Implementation order

Prerequisite 1 lands first. Prerequisite 2 is built. Prerequisite 3 is discharged — see the
amendment. Then each step compiles and its tests pass before the next begins.

1. ~~**Core modifier.**~~ **BUILT 2026-08-11.** `searchable()` on `SchemaString`,
   `SchemaBase.isSearchable`, `PropertyInfo.isSearchable`, and `SchemaSearchable` beside
   `SchemaDistinct`. Test: `core/src/schema/searchable.test.ts`.
   Decided while building:
   - **`searchable()` is exposed on `SchemaOptional` and `SchemaNullable` as well**, so
     `.optional().searchable()` and `.searchable().optional()` mean the same thing. `distinct()`
     is reachable in one order only, which is an invisible rule to learn.
   - **The flag is COPIED by `SchemaBase`'s copy constructor.** `isDistict` is not, so
     `.distinct().optional()` silently loses uniqueness — unnoticed only because that order does
     not compile. A searchable property that quietly stopped being indexed would change which
     rows a query returns.
   - **A non-string is gated by the BUILDER, not by a runtime check.** `searchable()` on the
     two wrappers declares `this: { instance: string }`, and `T` is the value type, so
     `s.number().optional().searchable()` does not compile. The `this` constraint names
     `instance` alone rather than the whole class: `SchemaBase` holds `T` contravariantly too
     (`valueSerializer`, `defaultValue`), so demanding a full `SchemaOptional<string, ...>`
     would reject `s.string("draft", "published")`, a perfectly good searchable string. A
     builder exists to offer only what is valid next; one that offers a method and then throws
     has gated nothing.
   - **`PropertyInfo.isSearchable` is DERIVED, not copied**: `schema.isSearchable && type is
     String`. The builder gate is a type, and types are erased at runtime, so a schema rebuilt
     from hand-written JSON can set the raw flag on a number. Deriving it once where it is read
     means no consumer has to re-check, and no producer has to be guarded.
   - **Compile rejects the two things the type system cannot express**: a searchable string
     nested in an `s.object()`, and a searchable property name over 100 characters. The latter
     is the key budget from "The index collection"; it binds only searchable properties.
   - **`isSearchable` round-trips through JSON Schema**, beside `isDistinct`. A rebuilt schema
     that dropped it would index nothing and report no error.
2. ~~**Tokenizer.**~~ **BUILT 2026-08-11.** `datastore/src/search/tokenize.ts` exports
   `tokenize`, `countTerms`, `ENGLISH_STOP_WORDS` and `TOKEN_LENGTH_CEILING`. Test:
   `datastore/src/search/tokenize.test.ts`, 31 cases.
   Decided while building:
   - **`countTerms` is a second exported function**, not a flag on `tokenize`. `tokenize` keeps
     duplicates because their count IS the term frequency; `countTerms` collapses them to the
     `Map` an index row is built from. Keeping both means the query side, which wants a
     deduplicated term list, never pays for counting.
   - **The 255-character ceiling is enforced twice** — once as a clamp on `maxTokenLength`, once
     on a custom tokenizer's output. The spec says a caller does not get to break the MySQL key
     budget; that is only true if the built-in path clamps a caller who sets
     `maxTokenLength: 900` as well.
   - **A custom tokenizer's empty tokens are dropped.** An empty term builds the key
     `|field|sourceId`, which collides with every other empty term for that document.
   - **A custom stop list is lowercased when `lowercase` is on.** Tokens are lowercase by the
     time the list is consulted, so a list written in title case would match nothing and look
     ignored.
   - **Null, undefined and any non-string produce no terms** rather than throwing. A nullable or
     optional searchable property is legal and contributes nothing.
3. ~~**Builder stage + generated schema.**~~ **BUILT 2026-08-11.**
   `datastore/src/collection-builder/fullTextSearch.ts` — `resolveFullTextSearch`,
   `FullTextSearchRegistry`, the generated index schema — plus `.fullTextSearch()` on both
   builder stages and `fullTextSearches` on `CollectionDependencies`. Test:
   `datastore/src/collections/fullTextSearch.test.ts`, 15 cases.
   Decided while building:
   - **RENAMED from `.searchIndex()` to `.fullTextSearch()`** (with the user). Every other stage
     on this builder names what the collection DOES — `softDelete`, `audit`, `scope` —
     while `searchIndex` named an artifact, and specifically the one artifact this design keeps
     private. `.fullTextSearch()` is unambiguous and leaves the generated collection out of the
     caller's vocabulary.
   - **There is no "the key must be a string or a number" check.** `key()` exists only on
     `SchemaString`, `SchemaNumber` and a computed constrained to `IdType`, so the builder
     already guarantees it and such a check could never fire. What CAN be declared and cannot
     work is a COMPUTED key: it changes when the entity changes, so an ordinary edit strands
     every index row that embedded the old key. That is what is rejected.
   - **The generated index schema is registered with the store at DECLARATION**, not when
     maintenance is wired. A plugin builds its table from the schema collection, so a schema
     that arrives later is a table that does not exist on the first save.
   - **The options type IS `TokenizeOptions`.** The builder and the tokenizer take the same
     options because they are the same options; a second parallel type would drift.
4. ~~**Previous values on the change record.**~~ **BUILT 2026-08-11.** `previous` on
   `EntityUpdateInfo` and on `AuditChange`, produced by `ChangeTracker`, turned on by
   `enablePreviousValues()`. Test: `datastore/src/collections/previousValues.test.ts`, 8 cases.
   Decided while building:
   - **`previous` never reaches a plugin.** It sits on `EntityUpdateInfo` because participants
     read the same assembled changes the plugin is then given, so `DataStore` DELETES it
     immediately before building the persist event. Leaving it on would put the old value of
     every changed property into every plugin's payload, and over a wire for the HTTP family,
     to be ignored by all of them.
   - **All three modes are reconstructed the same way** — rebuild the previous ENTITY, then run
     it through the existing `serializeDelta`. That reuses one serializer path and one shape
     rather than three. Proxy restores `__tracking__.original` over a clone (originals are
     keyed by the same dotted paths as the changes); immutable already holds
     `PendingUpdate.original`; diff clones at attach.
   - **Diff reports EVERY root property, not the changed ones.** Its change detection is a
     content hash, so "which property moved" has no answer — the same "assume everything"
     convention its empty `delta` already uses. Documented on the type rather than left for a
     consumer to discover.
   - **The diff baseline is re-taken on persist**, beside `snapshotHash`. Without that the next
     save reports the state before the LAST save and a consumer deletes rows that are already
     gone.
   - **A property changed twice before one save reports what it held before the FIRST change.**
     That falls out of the proxy's own rule — it records an original once and never overwrites
     it — and it is the only answer that lets a consumer undo everything the save does.
   - **Capture is STANDARD, not opt-in** (decided with the user, 2026-08-11). An earlier version
     gated it behind `enablePreviousValues()` called by `.fullTextSearch()`; that is removed.
     `previous` is part of what an update IS, so a consumer can rely on it without knowing what
     else the store declared, there is one code path rather than two, and an audit wanting
     before-and-after gets it with no extra declaration. The cost is paid always: one clone per
     changed entity when changes are assembled, plus — for diff tracking only — one clone per
     attached entity held while it stays attached. Proxy and immutable already had their
     previous values for free.
   - **A `markDirty()` update reports every root**, like diff. Nothing was recorded as changed,
     so no property can be named, and the entity as it stands IS its previous state.
5. ~~**Index maintenance — steady state.**~~ **BUILT 2026-08-11.** `FullTextSearchRegistry.apply`
   / `deferredAdds` / `detach`, wired in `DataStore` beside the audit registry. Test:
   `datastore/src/collections/fullTextSearchIndex.test.ts`, 13 cases.
   Decided while building:
   - **An add whose key the DATABASE assigns cannot ride the document's transaction.** The index
     row's key embeds the source id, and an identity key does not exist until the insert has
     run. Those rows go in a follow-up write driven from the RESOLVED adds. Guarantee 2 is
     therefore exact for updates, removes, and adds with a caller-supplied key; an
     identity-keyed add is indexed a moment after it lands. The failure is still reported to the
     caller — a save whose index write fails is a failed save — which is the difference from the
     view path this replaced, where it was a log line.

     **Accepted as a trade-off (with the user, 2026-08-11), not carried as a defect.** It is not
     fixable in this codebase: the id does not exist until the insert runs. The exposure is a
     process death between the two writes, which leaves a document that is not findable until a
     rebuild. A caller who wants it gone generates ids in the application instead of declaring
     `.identity()`, which makes every path single-write — a schema decision, not a code change.
     Do not re-propose deferring updates and removes to match; that would trade an exact
     guarantee on three paths for consistency with the one that cannot have it.
   - **`deferredAdds` must skip what `apply` already indexed.** It reads the resolved adds,
     which include every add rather than only the ones that waited for a key, so a
     caller-supplied-key collection indexed every new document TWICE — once in its own
     transaction and once after. Caught by the same-save test, which saw two batches. Fixed with
     a per-save set of already-indexed source ids.
   - **Remove rows are derived from the entity as submitted, not read back.** A read here would
     make the save asynchronous for the one case that does not need it. The sharp case — a
     document edited AND removed in one save, where the entity holds edited values but the index
     holds last-saved ones — is safe because the tracker reports both the update and the remove,
     so the update re-keys the rows before the remove deletes them. Pinned by a test, because it
     is a property of the tracker rather than of this code.
   - **Only fields named in `previous` are re-tokenised.** Editing a title leaves a
     4000-character body's rows untouched. Diff-tracked collections name every root, so they
     re-tokenise everything — the cost of a mode that cannot say which property moved.
   - **Index rows are detached from the changes AND the result**, exactly as audit rows are, so
     the caller's reported counts are the changes they made.
6. ~~**Index maintenance — rebuild.**~~ **BUILT 2026-08-11.**
   `datastore/src/search/FullTextSearchIndexer.ts`, exposed as
   `collection.fullTextSearch.rebuild()` and `.check()`. Test:
   `datastore/src/collections/fullTextSearchRebuild.test.ts`, 8 cases including the
   two-paths-one-answer invariant.
   Decided while building:
   - **It is a PUBLIC API, not an internal initial-build path** (with the user, 2026-08-11).
     Because an identity-keyed add is indexed in a follow-up write, a process death can leave a
     document unindexed — so users need to be able to build a self-healing scheduled job. The
     namespace mirrors the declaration: `.fullTextSearch()` declares it,
     `.fullTextSearch.*` operates it.
   - **`check()` is separate from `rebuild()`.** A repair that silently fixes drift also hides
     whatever caused it; a check lets a scheduled job report instead. It returns
     `{ missing, extra, stale, isHealthy }` and writes nothing.
   - **Not the `View` mechanism after all.** The spec assumed the rebuild would reuse `View`,
     but the reconcile it needs is a diff of two flat row sets with no subscription, no
     coalescing and no disposal — `View`'s machinery exists for a live derivation, and none of
     it applies to a one-shot recompute. Reimplementing that diff is ~40 lines; adapting `View`
     would have been more.
   - **Both operations read the RAW tables, not the collections.** A soft-deleted document
     belongs in the index — it is filtered out later at the read — so reading through a scoped
     collection would delete its rows on every repair.
   - **A healthy index writes nothing at all**, which is what makes it safe on a schedule. The
     unavoidable cost is reading every document to know what the index should contain, so it
     belongs in a scheduled job rather than on a request path.
   - **Both reject rather than throwing synchronously** on a collection with no index. An
     awaited call that throws before returning a promise escapes the caller's try/catch.
7. ~~**`search()` in the query builder.**~~ **BUILT 2026-08-11.**
   `datastore/src/search/SearchQueryable.ts`, exposed as `collection.search(...)`. Test:
   `datastore/src/collections/search.test.ts`, 18 cases.
   Decided while building:
   - **Not built on the join option, and not via `create(extend)`.** `SearchQueryable` is its
     own composable type that resolves the index lookup, then reads the matched documents
     through the collection's own `QueryableAsync`. Two round trips rather than one join. The
     join would save a trip; it would not change an answer, and threading a tuple-shaped join
     result back into an entity-plus-score shape was more machinery than the trip costs. Worth
     revisiting as an optimisation, not a correctness fix.
   - **`where` pushes down; `sort`, `skip`, `take` and `map` do NOT.** The ranking is a score
     this datastore computes, so a backend cannot honour it — pushing `LIMIT 3` down returns
     three real rows in a plausible order that are not the three best. Exactly the sticky
     ratchet `.nearest()` already uses, and pinned by a test. `where` is safe because it
     narrows documents rather than reordering them.
   - **Documents are read through the COLLECTION, not the raw table**, so soft-delete scopes and
     `.scope()` filters apply. A soft-deleted document can sit in the index and still never come
     back from a search, which is the behaviour the spec asks for.
   - **`score` is defined non-enumerable.** It survives property access but not
     `Object.keys`, `JSON.stringify` or a structured clone — it is a fact about a result, not a
     property of the entity, so it cannot leak into a comparison against a stored row.
   - **The default type parameter IS the scored shape**, so `toArrayAsync()` returns
     entity-plus-score and `.map(x => x.title)` returns `string[]` with no score. That is how
     "map drops the score" is expressed in the type rather than only in prose.
   - **A selector naming a non-searchable property throws.** Returning nothing would read as
     "no results" rather than as the mistake it is.
   - **The compile-time test in the original plan is a runtime throw instead.** `search()` lives
     on `CollectionBase`, so it exists on every collection; gating it by type needs the declared
     flag threaded through both builder stages as a type parameter. Deferred deliberately — the
     throw names the fix, and the type-level gate can be added without changing any behaviour.
8. ~~**Cross-backend proof.**~~ **BUILT 2026-08-11.** `describeFullTextSearch` in
   `test-utils/src/fullTextSearchContract.ts` — 13 cases, one set of expectations, run against
   **nine backends**: memory, Dexie, file-system, browser-storage, SQLite, PouchDB, Cloudflare
   D1 (Miniflare), PostgreSQL and MySQL. Not `dialectConformance.ts`, which is SQL-only; the
   `describeVectorSearch` model is the right one, for the reason that file already records.
   Found while building — every one of these was a real defect, not a test problem:
   - **The generated index schema needed a `documentType` discriminator.** PouchDB and
     browser-storage keep every collection in one physical store and separate them with a
     caller-declared discriminator; a GENERATED schema has no caller. Without it, reading the
     index returned the source documents (`check()` reported four phantom extra rows) and a
     repair would have deleted real rows.
   - **The index key had to be named `_id`.** PouchDB matches a write's response back to its
     operation by `entity._id`, so a key named anything else made every index update and remove
     fail with "Cannot classify resulting doc". No other backend objects, and MongoDB requires
     the same name.
   - **MySQL's `maxTokenLength` truncation is asserted on every backend**, not just MySQL —
     truncation happens in core, so the answer must not depend on which engine stores the row.
   - **PouchDB needed one plugin fix, and it was a defect in that plugin.** Index rows are built
     from the document being saved, so they carry an id and never a `_rev` — and PouchDB needs a
     revision to update or delete. Every edit to an indexed document failed with a conflict
     whose only detail was the literal `true` (`doc.reason ?? doc.error` on a `bulkDocs`
     conflict response).
     The first reading was that the datastore would have to read each row before writing it,
     which would mean a read inside every save on every backend for one backend's protocol.
     That is only true of doing it in the DATASTORE. A revision is a fact the database owns, so
     the plugin is the layer that should look it up: `_withRevisions` resolves every missing
     `_rev` in a single `allDocs`, only when at least one is missing, and never on the path
     where every entity already carries its own.
     This fixes more than search. PouchDB used to make its write protocol the caller's problem —
     a schema had to declare `_rev` and every entity had to hold the current value — which is
     the same shape of leak as the MongoDB `_id` rule below. `requiresDocumentRevision` in the
     contract is now an optimisation a caller may take, not a requirement. All 13 cases pass.
   - **MongoDB needed one plugin rule relaxed, and it was a defect in that rule.**
     `assertMongoSchema` rejected any `_id` not declared `.identity()`, reasoning that Mongo
     fills a missing `_id` in and the change tracker cannot match a value it never issued. That
     only describes a key NOBODY supplies — and a key without `.identity()` is by definition one
     the caller supplies, so Mongo never invents it. The rule was stricter than the database and
     rejected schemas that work. Removed, with the reasoning recorded at the site and its test
     rewritten to assert the new behaviour. This does not violate guarantee 1: no search code
     went into a plugin, and an ordinary caller-keyed Mongo schema gains the same freedom.
     Verified against MongoDB in a container — all 13 cases pass.
   - **Two approaches that do NOT work, recorded so they are not retried.** Declaring the index
     `_id` as `.identity()` satisfies Mongo and breaks SQLite. Naming the key anything other
     than `_id` satisfies SQLite and breaks PouchDB. The generated schema has exactly one shape
     that suits every backend, and it is the one that is there.
9. ~~**Docs.**~~ **BUILT 2026-08-12.** `docs/concepts/queries/full-text-search.md`, extracted
   into `examples/from-docs/concepts/queries/full-text-search/` and synced to
   `docs/_includes/`, plus a sidebar entry. Every stated limit is there: TF-only ranking with no
   length normalisation, `'all'`/`'any'`, no stemming, no phrase or proximity search, one index
   per collection, root-level strings only, single key only, the score being non-contractual,
   and the replication exclusion.
   Decided while building:
   - **Every example is executed by a test**, `datastore/src/collections/docExamples.test.ts`.
     A documentation example that does not compile is worse than none, because it is the first
     thing a reader copies. The seven cases are the page's own declarations and calls.
   - **Written to the `tech-writing` skill's rules** (ASD-STE100), which is why the page reads
     shorter than this spec: short sentences, active voice, one idea each.
   - **`npm run extract:doc-code` and `sync:examples` re-sync PRE-EXISTING drift** across ~20
     unrelated include files — `examples/from-docs/**` and `docs/_includes/code/**` are out of
     step in the committed tree. Those were reverted so this change stays reviewable. Worth a
     separate pass: whoever runs `docs:prepare` next will hit the same churn.

## Why the engine's own search is out

Recorded so it is not re-proposed. FTS5, `tsvector`, and `FULLTEXT` tokenise, stem, and rank
differently, so adopting any of them later would change which rows come back and in what order
on one backend but not the others — it is not an acceleration that can be turned on
transparently, the way a pgvector index or an incremental derive can, because those produce
the SAME answer faster. Any application that needs a specific engine's ranking semantics needs
that engine directly, and this feature would be lying to it.

## See also

- `specs/joins.md` — prerequisite 2, built; `search()` is a consumer of joins
- `specs/write-batching.md` — named incremental derive, which this feature no longer waits for
- `datastore/src/collection-builder/audit.ts` — the save-pipeline precedent steady-state
  maintenance follows; read `AuditRegistry.apply` and `detach` before writing any code
- `datastore/src/DataStore.ts:291` — the pipeline site both registries run at
- `datastore/src/views/View.ts` — the REBUILD path only; read the `accumulates` flag before
  touching the index schema's key
- `datastore/src/change-tracking/ChangeTracker.ts` — diff tracking's `snapshotHash`, the mode
  that must start capturing previous values
- `datastore/src/collection-builder/CollectionBuilder.ts` — the `audit()` two-stage precedent
  for `.fullTextSearch()`
- `core/src/schema/property/types/SchemaVector.ts` — the precedent: recognised not behaving,
  same answer on every backend
- `plugins/mysql/src/utils.ts` — the `VARCHAR` mapping behind the key-length budget
- `specs/plugin-roadmap.md` — the entry this supersedes
