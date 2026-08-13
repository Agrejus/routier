# Joins

Status: **All 11 steps built.**

Joins work end to end on every supported backend: memory, file-system, browser-storage, Dexie,
PouchDB, MongoDB, SQLite, Cloudflare D1, PostgreSQL, MySQL, and HTTP — plus across two plugins. The
four SQL backends emit a real `JOIN`, and PostgreSQL and MySQL are verified against real servers in
containers. Every one of them runs the SAME conformance suite, which is what makes guarantee 1 a
fact rather than an intention.

Date: 2026-08-10 (supersedes the
2026-07-31 proposal, and corrects two things from this spec's own earlier revision: expression
trees DO have a serialization story — the params pattern — and there is NO new plugin
interface surface: `IDbPlugin` keeps exactly its four members, forever).

First consumer: `specs/full-text-search.md`, which is blocked on this spec. Search joins its
index collection (a view) to its source collection, so views MUST work as a join side — that
is a requirement here, not a nice-to-have.

## The architecture, in one paragraph

A join is a FIRST-CLASS QUERY OPTION, not a datastore side-path. `join`/`leftJoin` on the
query surface record a `join` entry into the same `QueryOptionsCollection` every other
operation uses, built with the same expression machinery: key selectors parse to property
paths, values travel in params objects, nothing bespoke. The option flows to the plugin inside
the ordinary query event, and the plugin INTERPRETS it — a SQL backend emits a real
`INNER JOIN`/`LEFT JOIN`; every other backend loads the rows it needs and the shared
translator hash-joins in memory INSIDE the plugin. Core never negotiates capability and never
asks the plugin what it can do: the abstract method on `DataTranslator` forces every
translator to answer, exactly the way `nearest` already works. Where the answer is produced
changes per backend; the answer never does.

## The two corrections, recorded so they are not re-litigated

1. **Expression trees serialize via the params pattern** — and COMPLETE tree serialization now
   exists too (`core/src/expressions/serialize.ts`, added 2026-08-11).

   `expressionToJson` / `expressionFromJson` turn a bound tree into plain JSON and back. It needed
   no change to the expression classes, because the problem was one node: only
   `PropertyExpression` holds anything JSON cannot carry, and it reduces to a property PATH —
   `PropertyInfo.id` is the dotted path and `CompiledSchema.getProperty` is keyed by exactly that,
   so rebinding is one lookup. Everything else is a string, a flag, or a literal (with a tag for
   the shapes JSON drops: `Date`, `undefined`, `NaN`/`Infinity`).

   Two things that made it smaller than this spec expected:

   - **No schema id in the payload.** `fromJson` takes the schema to rebind against. A filter
     always belongs to a known collection and the RECEIVER's schema is the authority on its
     properties — embedding an id would invite rebinding against a schema the sender chose, which
     is backwards across a trust boundary.
   - **No params to send alongside.** `ParamReferenceExpression` never escapes the parser: binding
     replaces it with a plain `ValueExpression` holding the resolved value, so a serialized tree is
     always already bound.

   An unresolvable property path THROWS rather than degrading to `not-parsable`. On a receiver, a
   filter that silently stops filtering returns rows the requester was never meant to see.

   Verified two ways, both over `JSON.parse(JSON.stringify(...))`: identical `evaluate` answers
   (`core/src/expressions/serialize.test.ts`), and byte-identical SQL and bound parameters across
   all four dialects (`plugins/sql-core/src/serializedExpressions.test.ts`).

   This unblocks REMOTE join pushdown — a server executing a forwarded join instead of the HTTP
   plugin fetching both sides. Joins never needed it, and still do not.
2. **`IDbPlugin` does not change.** Its four members — `databaseName`, `query`, `destroy`,
   `bulkPersist` (`core/src/plugins/types.ts:10-50`) — are the whole plugin contract. No
   `supports?()` method, no capability flag, no registry (the 2026-07-31 draft cited a
   "capability model in `core/src/capabilities`" that does not exist and must not be built).
   Whether a plugin pushes the join down is the plugin's private business, expressed the way
   PostgreSQL already expresses `nearest` pushdown: the plugin builds its native query, knows
   whether it included the join, and constructs its own translator with that boolean; the
   translator's `join` is then a pass-through gated on
   `this.joinPushedDown && option.target === "database"`
   (`plugins/postgresql/src/PostgresSqlTranslator.ts:36-41`,
   `plugins/postgresql/src/PostgresDbPlugin.ts:136-138`).

## Guarantees

1. **Same answer everywhere.** The same data and the same join return the same pairs on every
   plugin, wherever the join executed (native SQL, in-plugin hash join, in-datastore residue).
   The dialect conformance suite (`e2e/src/dialectConformance.ts`) gets a join scenario (with
   an explicit `.sort()`, since pair order is undefined without one) asserting this.
2. **Each side is read under its own scopes.** Soft-delete scopes and `.scope()` filters for
   BOTH collections are part of the join option's per-side filter sets, so every interpreter —
   including a native SQL join — applies them. See the correctness trap below.
3. **Pushdown is invisible.** Whether a backend joined natively or the translator hash-joined
   is observable only as speed.

## API

```ts
// Inner equi-join: pairs where p._id === m.playerId
store.players
    .join(s => s.playerMatches, p => p._id, m => m.playerId)
    .where(([p, m]) => p.rank > 10 && m.won === true)
    .sort(([p, m]) => p.rank)
    .map(([p, m]) => ({ name: p.name, matchId: m._id }))
    .toArrayAsync();

// Left join: unmatched outer rows appear with undefined on the right
store.players
    .leftJoin(s => s.playerMatches, p => p._id, m => m.playerId)
    .toArrayAsync();

// A collection on ANOTHER store is passed directly — a selector cannot reach outside its store
localStore.players
    .join(remoteStore.playerMatches, p => p._id, m => m.playerId)
    .toArrayAsync();
```

```ts
join<TInner extends {}, TKey extends string | number>(
    inner: JoinTarget<TStore, TInner>,
    outerKey: (outer: InferType<TOuter>) => TKey | null | undefined,
    innerKey: (inner: InferType<TInner>) => TKey | null | undefined
): JoinQueryable<TOuter, TInner>;

leftJoin<TInner extends {}, TKey extends string | number>(...same...): JoinQueryable<TOuter, TInner | undefined>;

// Either the sibling collection off this store, or a collection handed over directly
type JoinTarget<TStore, TInner extends {}> =
    | ((store: TStore) => CollectionRef<TInner>)
    | CollectionRef<TInner>;
```

- **The inner side is normally named by a STORE SELECTOR** (`s => s.playerMatches`). A store can see
  its own collections, so naming the store twice to reach a sibling is noise. `TStore` reaches the
  collection through `DataStore.collection()`'s `this` return type — polymorphic `this` in a
  subclass's field initializer IS that subclass — so the selector is checked against the concrete
  store and a wrong name is a compile error. This is NOT circular: the collection's type mentions
  the store only inside a parameter position, which TypeScript resolves lazily.
- The direct `CollectionRef` form stays, because a selector cannot express a **cross-store** join —
  `s` is the store the query started on. That case is supported and tested.

- `CollectionRef` is the public query surface of a created collection, and for joins it must
  expose three things: the compiled schema, the collection's scoped query options (so
  `innerOptions` can carry soft-delete and `.scope()` filters), and the plugin it belongs to.
  Views qualify (they extend `CollectionBase` — `datastore/src/views/View.ts:49`).
- Key selectors are SINGLE PROPERTY PATHS, parsed with the existing selector extraction in
  `datastore/src/queryable/base/QueryBuilderBase.ts` (`getFields`). A selector that is not a
  single property path, or names a property missing from the schema, throws at query build
  time. There is no closure fallback for keys: the join algorithm needs the key VALUE, not a
  predicate.
- Both selectors constrain to the same `TKey`, so mismatched key types fail at compile time.
  Additionally, both key properties must be of schema type `string` or `number` — any other
  type (`Date`, boolean, object, computed) throws at query build time. Hash-join keying and
  cross-backend equality need primitives; `Date` keys in particular compare by reference in
  JS and by value in SQL, which would violate guarantee 1.
- Options recorded BEFORE `.join()` (`store.players.where(...).join(...)`) are ordinary
  outer-side options and push down exactly as they do today. Options recorded AFTER the join
  are post-join tuple options.
- Without `.map()`, terminators return the tuples. Tuples are allowed everywhere. The v1
  terminator set on `JoinQueryable` is: `toArray`/`toArrayAsync`, `first`/`firstAsync`,
  `firstOrDefault`/`firstOrDefaultAsync`, and `count`/`countAsync`. `sum`/`min`/`max`/
  `distinct` and `subscribe` are NOT declared on the tuple queryable — absent from the type,
  not runtime throws.
- `JoinQueryable` is a typed API surface only — it records options into the one
  `QueryOptionsCollection`; it does not own an execution path.

### Why explicit key selectors (recorded so a predicate-join is not re-proposed)

1. They guarantee an equi-join, so the fallback execution is a hash join — O(n + m), never a
   nested loop over a free-form predicate.
2. They map 1:1 to SQL `JOIN ... ON a.x = b.y` and to a params-`includes` semi-join filter.
3. Non-equi conditions still work — they go in `.where()` after the join, where they run
   post-join and are correct, just not accelerated.

### Semantics

| rule | behaviour |
| --- | --- |
| Key equality | Strict `===` on the two key values, in ENTITY shape, and key properties are `string` or `number` by the build-time rule above. An interpreter working in storage shape (a SQL join, or the memory plugin's raw records) must produce results identical to entity-shape comparison — `from`-renamed columns resolve via `getResolvedName()`, the same discipline `SqlTranslator.nearest` already follows. |
| Null keys | `null`/`undefined` key values never match anything. In `leftJoin` those outer rows still appear, paired with `undefined`. |
| Duplicates | Every matching pair is emitted: two outer rows with the same key each pair with every matching inner row (full cross product per key group). |
| Change tracking | Off. Join results are read-only projections, exactly like `.map()` results today — they never attach to the change tracker. |
| Ordering | Undefined unless the query has `.sort()`. Conformance tests always sort. |
| Empty sides | An empty side yields no pairs (`join`) or all-left-with-undefined (`leftJoin`). |

## The join in the internal query

A new entry in `QueryOptionValueMap` (`core/src/plugins/query/types.ts:21-50`):

```ts
join: {
    kind: 'inner' | 'left';
    innerSchemaId: SchemaId;          // resolved through event.schemas, which already
                                      // carries every schema in the store
    outerKey: { propertyName: string; property: PropertyInfo | null };
    innerKey: { propertyName: string; property: PropertyInfo | null };
    innerOptions: QueryOptionsCollection;  // the inner side's own filters — INCLUDING its
                                           // soft-delete scope and .scope() filters — plus
                                           // any pushed-down conjuncts
};
```

- The OUTER side's filters/scopes are the query's ordinary leading options, as today.
- Values in any filter travel in params objects, never baked into the tree — the existing
  discipline, and what keeps the whole option serializable once tree serialization lands.
- `QueryOptionsCollection.add` treats `join` like `nearest`
  (`core/src/plugins/query/QueryOptionsCollection.ts:119-134`): the option itself targets
  `"database"`, and everything AFTER it ratchets to `"memory"` — post-join `where`/`sort`/
  `map`/`skip`/`take`/aggregates run in core's memory half over the joined tuples, because
  core cannot know how the plugin executed the join. (Post-join tuple options run as plain
  closures in the memory half — tuples have no schema, so `JsonTranslator` is not involved;
  the memory half gains a small tuple-aware pass beside it.) A `nearest` recorded before the
  join ratchets the join option itself into the memory half — the datastore then interprets
  the join exactly as it does for cross-plugin queries: correct, just never pushed down.
- Post-join conjunct SPLITTING — classifying top-level `&&` conjuncts of a tuple `where` and
  moving single-side conjuncts into that side's options before the query is sent — is the
  same optimization as before and lives in the query builder, before dispatch. The
  tuple-destructured lambda `([p, m]) => ...` parses with two roots, extending the two-root
  parsing the params-filter path already has (`core/src/expressions/parserCoverageGaps.test.ts`
  uses `'[r, p]'` roots). A conjunct that fails to parse stays post-join — correct, just not
  accelerated.

## The shape of a joined result (the wire contract)

Left unstated, this is the likeliest place for an implementation to go wrong, so it is a
contract: **the translator's `join` output is an array of tuples, `[outer, inner][]`
(`[outer, inner | undefined][]` for `left`), with EACH element fully deserialized into its
own schema's ENTITY shape.** Flat combined rows never leave a translator.

What that means per interpretation:

- A native SQL join produces one flat row of combined columns. The plugin must alias columns
  per side to disambiguate collisions (both tables having `id`, `name`); the aliasing scheme
  is plugin-internal — the contract is only the tuple output — but `o__`/`i__` prefixes are
  the suggested convention. The plugin then splits each flat row, deserializes the outer half
  with the outer schema and the inner half with the inner schema, and emits the tuple. An
  all-`NULL` inner half under `LEFT JOIN` becomes `undefined`, not an entity of nulls — and
  the implementation must distinguish "no match" from "matched row whose columns are null"
  (use a `NULL`-check on the inner KEY column, which is non-null on any real row, never a
  check over all columns).
- An in-plugin hash join already holds each side's rows separately; it deserializes each side
  with its own schema (the inner side does NOT go through the outer query's normal
  single-schema deserialization — `DatabaseDataAccessStrategy.query` transforms against
  `event.operation.schema` only, which is the OUTER schema).
- Downstream, `QueryableExecutor.postProcessQuery` must treat tuple results specially:
  `IQuery.changeTracking` is `false` for any query containing a `join` option (change
  tracking is off by the semantics table), so there is no attach, no freeze against the root
  schema, and no delivered-membership capture (`captureDeliveredMembership` is single-schema
  and does not apply). Tuple results go straight to the tuple-aware memory pass and out.

`DataTranslator` gains an abstract `join` method (`core/src/plugins/translators/DataTranslator.ts`
— the `nearest` precedent at `:44-55`: abstract ON PURPOSE, so a translator cannot silently
ignore it and the compiler forces every plugin's translator to answer when the option ships).

The three interpretations:

1. **Native (SQL backends).** The plugin's query builder sees the `join` option, emits
   `INNER JOIN`/`LEFT JOIN ... ON`, includes the inner side's `innerOptions` filters in the
   SQL, and constructs its translator with `joinPushedDown = true`; the translator's `join`
   is a pass-through. SQLite/D1, PostgreSQL, MySQL.
2. **In-plugin hash join (everything else).** The translator hash-joins in memory. It needs
   the inner side's rows, which the PLUGIN supplies — each plugin already knows how to read a
   collection by schema, and the wiring lives in the shared bases, not per plugin:
   `EphemeralDataPlugin` (memory, file-system, browser-storage) resolves the inner collection
   locally (`core/src/plugins/EphemeralDataPlugin.ts`, `resolveCollection`); Dexie/PouchDB/
   MongoDB read the inner store/collection through their existing access and hand rows to
   their `JsonTranslator`-derived translator, which owns the join algorithm once. This is the
   user-facing promise "backends that can't interpret the join select the rows and it happens
   in memory" — inside the plugin, over rows it already knows how to load.
   Optimization available to every interpreter here: run the outer side first, collect
   distinct join keys, and load the inner side with a params-`includes` prefilter (the parser
   already emits a database-executable expression for that shape —
   `core/src/expressions/parserExpandedSyntax.test.ts`) when the key count is at or below
   `semiJoinKeyThreshold`, a datastore option, default 500. Above the threshold, load the
   inner side with its `innerOptions` only. Cost only; never answers.
3. **Remote (HTTP/replication).** Until expression-tree serialization is complete, the join
   option cannot cross the wire — so `HttpDbPlugin` interprets it locally: fetch the outer
   side and the inner side as two ordinary serialized queries (filters + params, as today via
   `queryParamHelpers`), then its `JsonTranslator`-based translator joins in the plugin. When
   tree serialization lands (the small separate spec named above), the whole join option can
   be forwarded and the server becomes interpretation 1 or 2 — with no change to this design,
   because the option was built serializable from day one.

**The correctness trap, stated so it is tested and not discovered:** interpretations 1 and 2
bypass the inner collection's normal datastore read path, so the inner side's soft-delete
scope and `.scope()` filters exist ONLY because `innerOptions` carries them. An interpreter
that ignores `innerOptions` returns soft-deleted rows. The conformance scenario must include a
soft-deleted inner row and a `.scope()`d inner collection so every backend proves it applies
them.

**Cross-plugin joins** (the two collections live on different plugins or stores — detected by
PLUGIN INSTANCE IDENTITY, `outer.dependencies.plugin === inner.dependencies.plugin`, never by
comparing database names): the join option cannot be sent to either plugin, so the datastore
itself is the interpreter — it runs
each side as an ordinary query through `DataBridge` and hash-joins in its memory half with the
same shared algorithm. This is the one case core executes the join, and it reuses the same
code the translators use (the hash join is written once, in core, and called from both
places).

## Decisions, recorded

1. **The join is a query option interpreted by translators — not a datastore executor
   side-path.** Everything translates into the one internal query; plugins interpret what they
   receive. (User decision, 2026-08-10.)
2. **`IDbPlugin` never changes for this feature.** Four members, nothing more. No capability
   surface anywhere. (User decision, 2026-08-10.)
3. **Values travel in params objects; the tree stays value-free.** Completing expression-tree
   serialization (`toJSON`/`fromJSON`, property paths re-bound against the receiver's schema)
   is a separate small spec, prerequisite only for remote pushdown.
4. **Projection before terminators: not required.** Tuples are allowed everywhere.
5. **Semi-join threshold: datastore option `semiJoinKeyThreshold`, default 500.** No
   per-query override in v1.
6. **Views as a join side: required.** Full-text search depends on it.
7. **Post-join options ratchet to the memory half**, mirroring `nearest`'s sticky ratchet —
   core cannot know how the plugin executed the join, so nothing after it is pushed down
   except conjuncts the builder split off BEFORE dispatch.
8. **Subscriptions on joins: out of v1** (a join subscription must listen to both schemas and
   re-run; `DataBridge.subscribe` is single-schema today). `search()` in the full-text spec
   does not promise subscriptions either.
9. **`groupJoin`, chained joins (3+), and aggregates beyond `count`: out of v1.** The tuple
   queryable's terminator set is fixed in the API section; `sum`/`min`/`max`/`distinct` are
   absent from the type. `count` runs in the memory half over tuples. No speculative hooks.
10. **Mongo `$lookup` is deliberately not used in v1** — interpretation 2 is correct there,
    and the translator surface for `$lookup` is not worth it until measured.

## Per-plugin expectations

| plugin | interpretation | notes |
| --- | --- | --- |
| Memory / file-system / browser-storage | 2, wired once in `EphemeralDataPlugin` | key-equality fast path makes point joins cheap; semi-join prefilter applies before cloning |
| Dexie / PouchDB / MongoDB | 2, via their `JsonTranslator`-derived translators | inner rows loaded through existing plugin data access |
| SQLite / D1 / PostgreSQL / MySQL | 1 — **built** | native `JOIN`; `innerOptions` filters (incl. soft-delete scope) appear in the **ON** clause, never a `WHERE` — see step 7's notes. PostgreSQL additionally casts a `uuid` key to text |
| HTTP / replication | 3 — **built** | two ordinary side-requests, paired in the plugin; whole-option forwarding after tree serialization lands. The SWR plugin refuses a join |
| cross-plugin / cross-store | datastore joins in its memory half | same shared hash-join code |

## Implementation order

Each step compiles and its tests pass before the next begins. Full-text search unblocks at
step 5.

> Built. Notes on what the code calls things: the tuple queryable is
> `datastore/src/queryable/JoinQueryable.ts` and its "or default" terminator is
> `firstOrUndefined`, matching the rest of the query surface rather than this spec's
> `firstOrDefault`. Key selectors accept a NULLABLE property (`TKey | null | undefined` on the
> public signatures, `TKey` still inferring as the underlying string/number) — a nullable foreign
> key is the ordinary case and the semantics were already defined for it.

1. **API surface and the option.** `join`/`leftJoin` on collections and views, tuple typing,
   the `join` entry in `QueryOptionValueMap`, build-time throws (non-path selector, missing
   property, mismatched key types as compile-time tests), `innerOptions` assembly including
   the inner side's scopes, and the post-join memory ratchet in `QueryOptionsCollection.add`.
> Built. `core/src/plugins/query/join.ts` holds the algorithm (`hashJoin`, `executeJoin`,
> `applyInnerOptions`, `toEntityShape`) and `core/src/plugins/translators/TupleTranslator.ts` is the
> tuple-aware memory pass. `JsonTranslator` takes the inner side through its CONSTRUCTOR rather
> than a `loadInner` callback: `DataTranslator.translate` is synchronous, so the plugin loads the
> rows before translating. `loadJoinInnerSide` in `join.ts` is the shared way to do that — it asks
> the plugin to run an ordinary query for the inner side.

2. **The shared hash join + abstract translator method.** `DataTranslator.join` abstract; the
   hash-join algorithm written ONCE in core (semantics table exactly: null keys, duplicates,
   left join, entity-shape equality); `JsonTranslator.join` implemented over a
   plugin-supplied inner-row source, callback-shaped like the rest of the codebase —
   `loadInner(query: IQuery, done: CallbackResult<Record<string, unknown>[]>): void`, where
   the query carries the inner schema and `innerOptions`; the tuple-aware memory-half pass
   for post-join options. Unit tests against the algorithm directly.
> Built, plus a cross-backend suite: `test-utils/src/joinContract.ts`
> (`describeJoinContract`) runs on memory, file-system, browser-storage, Dexie, PouchDB and
> MongoDB. That suite is where guarantee 1 is asserted; the dialect conformance scenario still
> wants adding once step 7 lands.

3. **Interpretation 2 for the ephemeral family.** Wire `EphemeralDataPlugin` to supply inner
   rows. Full semantics tests on the memory plugin: inner/left, null keys, duplicates, empty
   sides, post-join option ordering, change tracking off, soft-deleted and scoped inner rows
   excluded, views as inner side, a join keyed on a `from`-renamed property, and pre-join
   outer options (`.where()` before `.join()`) pushing down.
> Built, in `QueryableExecutor.postProcessJoinQuery`.

4. **Cross-plugin/datastore interpretation.** Two stores, two plugins, one join — datastore
   memory-half execution using the same shared algorithm.
5. **Ship for full-text search.** Steps 1–4 are everything search needs (its index and source
   live on the same plugin; the ephemeral and datastore paths cover every backend via
   interpretations 2–3 plugins pending, which do not block search on memory/SQL test
   coverage — but confirm the FTS conformance scenario against whichever backends are wired
   at this point).
> Built. Each plugin calls `loadJoinInnerSide` and hands the rows to its translator. PouchDB
> passes its UN-QUEUED `_query` as the inner reader: its queue serializes queries, so routing the
> inner read through `query` would wait on the outer read that is holding the slot.

6. **Interpretation 2 for Dexie/PouchDB/Mongo.** Inner-row loading per plugin, shared
   algorithm, shared test suite.
> Built for all four: SQLite, Cloudflare D1, PostgreSQL and MySQL. The emission is shared in
> `plugins/sql-core/src/joins.ts` (`buildJoinStatement`, `splitJoinRows`, `canPushDownJoin`), so each
> plugin is a query-path branch rather than a reimplementation. PostgreSQL and MySQL are verified
> against real servers (`e2e/src/postgresJoins.test.ts`, `e2e/src/mysqlJoins.test.ts`, both behind
> `E2E_CONTAINERS=1`), each store getting its own database because one server keeps its tables
> between tests. Four things the spec did not anticipate:
>
> - **The inner side's scopes go in the `ON` clause, not a `WHERE`.** A `WHERE` is applied after the
>   join, so on a `LEFT JOIN` an unmatched row — inner columns all `NULL` — fails any inner-table
>   condition and is discarded, turning the left join into an inner one. Found by the conformance
>   suite, which is exactly what it is for.
> - **A `sort`/`skip`/`take` recorded BEFORE the join must window the OUTER rows.** SQL applies
>   `ORDER BY`/`LIMIT` to the joined result, so the outer side is built by the ordinary single-table
>   builder and used as a derived table. That reproduces the in-memory ordering exactly.
> - **`toSql` needed a table alias.** It rendered unqualified columns, and any column present on
>   both sides is ambiguous — which a shared discriminator makes the normal case, not an edge one.
>   `SqlTranslator` now takes a `SqlPushdown` bag and refuses `join` unless the plugin claims it.
> - **PostgreSQL has no implicit `uuid = text`, and the everyday join shape crosses exactly that
>   boundary.** A single string identity key is a `uuid` column while the foreign key pointing at it
>   is `text`, so the most ordinary join there is failed outright. The uuid side is cast, never the
>   text side: casting text to uuid preserves the index but throws for the whole query the moment
>   one row holds a non-uuid value — and a foreign key pointing nowhere is precisely what a
>   `leftJoin` is for. The rule lives in `singleIdentityKeyProperty`, shared with the DDL so the two
>   cannot drift. SQLite, being typeless, never saw this.

7. **Interpretation 1 for SQL plugins**, one at a time starting with PostgreSQL: JOIN
   emission with per-side column aliasing and tuple splitting per the wire contract,
   `innerOptions` in the SQL, `joinPushedDown` translator pass-through, and the
   left-join-null-inner-key rule (unmatched → `undefined`, matched-with-null-columns → an
   entity). Tests: results identical to interpretation 2 on the same data, INCLUDING the
   soft-deleted inner row, colliding column names on both sides, and an inner row whose
   non-key columns are all null; the conformance scenario across all backends.
> Built for the two paths where the outer rows are known before the inner read: the ephemeral
> family (`EphemeralDataPlugin`, which now runs its outer query FIRST — that ordering IS the
> optimization) and the datastore's cross-plugin path, where the inner side is a separate round
> trip and the saving is largest. `distinctJoinKeys` and `semiJoinFilter` are in core, and
> `loadJoinInnerSide` takes the key set, so any plugin can adopt it.
>
> The threshold is `DataStoreOptions.semiJoinKeyThreshold` (default 500), carried INSIDE the join
> option: the decision is made where the join executes, usually inside a plugin, and a plugin
> cannot see a datastore's configuration. A number serializes; a store reference would not.
>
> Not wired for Dexie/PouchDB/Mongo/HTTP: they call `loadJoinInnerSide` before running their own
> query, so they have no outer keys to offer yet. Making them outer-first is the follow-up, and
> costs nothing in correctness meanwhile.
>
> The test that matters is not "results are the same" — that passes with the feature dead. It is
> `narrows the inner read below the threshold, and does not above it`, which watches what the inner
> plugin was actually ASKED for.

8. **Semi-join prefilter** where it pays (ephemeral family first), threshold tests at and
   above the boundary, results identical with it on and off.
> Built. The blocker recorded here earlier — that a tuple lambda cannot be parsed with two entity
> roots — turned out to be avoidable rather than real: **split the SOURCE at top-level `&&` first,
> then parse each conjunct on its own against ONE schema and ONE root**, which the existing parser
> already does. A conjunct naming the other side simply fails to parse, and that failure IS the
> classification. The parser needed no change; it gained one entry point, `parseFragment`, for
> parsing a fragment rather than a whole function.
>
> The second half was a runtime predicate for a conjunct that only exists as a tree — `new Function`
> being unavailable under a Content-Security-Policy. That is `evaluate(expression, row)` in
> `core/src/expressions/evaluate.ts`, the counterpart to `toSql`. **It FAILS OPEN**: `undefined`
> means "cannot judge", and `toPredicate` reads that as keep the row. It also short-circuits around
> what it cannot judge, so one unfamiliar sub-expression does not make a whole filter a no-op.
>
> **The caller's filter is never removed, only supplemented.** Split conjuncts are ADDED ahead of
> the join and into `innerOptions`; the original predicate still re-checks every surviving pair. So
> a conjunct misclassified or missed costs speed and cannot cost rows — which is what makes an
> inference like this safe to run by default.
>
> Splitting happens at DISPATCH (`QueryableExecutor.splitPostJoinConjuncts`), not at `.where()`: an
> outer conjunct must be ordered BEFORE the join option, and by the time the `where` is recorded the
> join is already behind it.
>
> Worth knowing what the parser will and will not give a tree for: `name.toLowerCase().includes(x)`
> and `name.length > 3` parse; `name.toLowerCase() === x` does not. An unparsable conjunct stays
> post-join, exactly as intended.

9. **Conjunct splitting.** Two-root tuple-lambda parsing, classification (outer-only /
   inner-only / both / not-parsable), residue correctness, identical results with splitting
   on and off.
> Built. `HttpDbPlugin` fetches both sides as ordinary collection requests and pairs them in the
> plugin; the join option never reaches the wire, because `buildQueryParams` serializes filters,
> sort and the window and ignores everything else. Both requests get the full retry and re-auth
> treatment, being ordinary queries.
>
> `HttpSwrDbPlugin` REFUSES a join rather than attempting one. It answers a read from a local store
> and revalidates against the remote: the local side would return tuples, the remote rows, and
> merging one into the other produces neither. Its cache key would collide too, being built from a
> serialized query the join option is absent from.

10. **HTTP plugin, interpretation 3.** Two side-queries, local join. (Whole-option forwarding
    waits for the tree-serialization spec.)
> Built: `docs/concepts/queries/joins.md`, linked from the queries index. It states the cost model
> per backend and says plainly which backends do not join yet.

11. **Docs.** The cost model plainly: what each backend does, what a join with no pushable
    filters reads, the threshold, and that interpretation differences are invisible in
    results.

## See also

- `specs/full-text-search.md` — first consumer; unblocks at step 5
- `core/src/plugins/query/QueryOptionsCollection.ts` — the database/memory split and the
  `nearest` ratchet this copies
- `core/src/plugins/translators/DataTranslator.ts` — the abstract-method discipline
- `plugins/postgresql/src/PostgresSqlTranslator.ts`, `PostgresDbPlugin.ts` — the pushdown
  template (plugin-local flag, translator pass-through)
- `plugins/replication/src/queryParamHelpers.ts` — the params serialization pattern
- `datastore/src/views/View.ts` — views as join sides
