# Known defects

Status: 60 of 61 fixed. #55 is a documented constraint, not a defect: the schema
codegen cannot survive minification, so minification stays off.
Date: 2026-08-06

Defects 1–10 came from the functional test program. #11–#13 came from the stress program
(`stress/`, see `specs/stress-testing.md`) and are the reason it exists: all three are
change-tracker state bugs that a single-operation test cannot see, because each needs a
*second* save to become observable. #18–#22 came from the same program later, once it grew
scenarios for concurrency (#18, #21) and real databases (#19, #20, #22). #27 and #29 came from the
plugin production-readiness audit (`PLUGIN_AUDIT.md`); #28 came from the test matrix written to
verify the #27 fix, which is the usual way the second bug in a family turns up.

Keep this line current. It said "14 of 18" while eight defects were open, which is the one
error in this file a reader cannot detect without reading the whole thing.

Ten defects were found by the test program, each reproduced and diagnosed. All ten are now
fixed and their pinning tests flipped to regular assertions, along with the four
contract-kit defects. The entries below are kept as a record of each defect and how it was
resolved.

## How defects are worked (for future entries)

Every open defect is **pinned by an `it.failing` test**. That inverts the usual meaning:

- The test **passes** while the defect exists.
- The test **fails** the moment the defect is fixed.

So when you fix one, the suite goes red and tells you to update the marker. That is
deliberate — it makes a fix impossible to land silently. The workflow is:

1. Fix the production code.
2. Run the suite. The pinning test now fails "because it passed".
3. Change `it.failing(` to `it(` and update the comment above it.
4. Check for a sibling test that *asserted the buggy behaviour* — several existed — and
   rewrite it to assert the correct behaviour. See #3 for a worked example.
5. Move the entry here to "Fixed".

Verify with `npx jest` (whole suite, ~50s, must exit 0).

---

## Fixed

### 1. `enrich` hoisted nested subtrees to the root (depth 2+) — **FIXED**

`schema.enrich({ id, nested: { inner: { value } } })` wrote each nested subtree at the root
keyed by its leaf name and emptied the true location, corrupting every change-tracked read
of a 2+-deep object.

**Cause:** `EnrichmentObjectHandler` / `EnrichmentNullableObjectHandler` attached every
nested ObjectBuilder to the ROOT literal. Nested builders are registered under
`[enriched.<path>]` names, and the block-path lookup walks the literal tree segment by
segment, so a depth-2 lookup never found its parent and fell back to the root.

**Fix:** `buildEnrichedObjectSlotPath` in `core/src/codegen/handlers/types.ts` builds the
full ancestor-chain slot path; both object handlers attach children to their parent's
builder, and `setEnrichedProperty` looks parents up the same way. Pinned shapes
`object-depth-2`/`object-depth-3` (`enrich-idempotent`) now pass.

### 2. Nested mutations were not tracked as dirty — **FIXED**

`tracked.nested.value = "x"` left `__tracking__.isDirty` false, so `saveChanges` silently
discarded the edit.

**Fix:** nested objects are proxied with the ROOT entity passed as the tracking parent and
the full dotted path (`enableChangeTracking(enriched.nested, "nested", enriched)`), so
nested writes record on the root's `__tracking__` under `nested.value`. During enrichment a
*paused*, *non-enumerable*, deleted-at-return `__tracking__` bootstrap prevents the proxy
installation writes from registering as changes — non-enumerable because computed
properties may `JSON.stringify` the entity (content-hash ids) and the bootstrap must not
change their input. Pinned by `ChangeTracker.test.ts`; the sibling nested-read test still
passes.

### 3. `TrampolinePipeline` swallowed processor errors — **FIXED**

Kept as the worked example of the workflow.

The trampoline caught a processor error, set `_hasErrored`, and broke out of the loop without
calling `done`, on the reasoning that the application should handle the uncaught exception.
It could not: the error was caught there, so nothing escaped, and every caller awaiting the
callback waited forever.

Fixed in `core/src/pipeline/TrampolinePipeline.ts` by reporting the failure on that path —
`done(currentData, error)` in `TrampolinePipeline`, `done(Result.error(...))` in
`WorkPipeline` (both classes had the defect, with different callback conventions).

**What the fix required beyond the production change**, which is the pattern to expect:

- Two `it.failing` markers flipped to `it`.
- A third test, `does not call done when a processor fails`, had *asserted the buggy
  behaviour*. It was replaced with `calls done exactly once when a processor fails`, pinning
  both directions — not zero (the old hang) and not twice.

### 4. PostgreSQL could not create its tables on first use — **FIXED**

Every first write failed with `25P02 current transaction is aborted`: the
create-table-on-demand recovery ran inside a transaction PostgreSQL had already aborted.

**Fix:** `PostgresDbPlugin.bulkPersist` now issues a `SAVEPOINT` before each write and
`ROLLBACK TO SAVEPOINT` before the DDL, so the retry runs inside a healthy transaction.
Also fixed while verifying against a real `postgres:16-alpine`:

- `SchemaTypes.Number` maps to `DOUBLE PRECISION` instead of `NUMERIC` (pg returns NUMERIC
  as strings; DOUBLE PRECISION matches the JS number type).
- `SqlTranslator.count` coerces bigint-string counts to numbers.
- The pool has an `error` handler — an idle client dropped by a server shutdown no longer
  kills the process.

`E2E_CONTAINERS=1 npx jest --selectProjects e2e` passes (requires Docker).

### 5. `clone` destroyed Dates inside arrays — **FIXED**

Array elements of type Date came back as empty objects (foreign-realm Dates under jest,
where `structuredClone` is the host-realm function and its Dates fail `instanceof Date`).

**Fix:** `CloneArrayHandler` dispatches on the element type — Date arrays copy per element
with `new Date(v)` in the local realm. Pinned shape `array-of-date` (`clone-isolation`) now
passes.

### 6. `enrich` and `merge` threw when a nested parent was absent — **FIXED**

`schema.merge({}, source)` and `schema.enrich({ id }, "diff")` threw
`Cannot read properties of undefined`.

**Fix:** merge default handlers materialize destination ancestors and use guarded selectors
(shared `emitDestinationAncestorGuards` / `emitMergeCopy` helpers); the enriched literal
reads children through guarded selectors (`entity.nested?.value`). Two behaviour corrections
surfaced with this:

- A defaulted property now also **merges from the source** (previously it was silently
  dropped on every merge); the copy is value-guarded (`valueOf`) so an equal value never
  replaces the destination reference (Date identity is observable by callers).
- `ChangeTracker.mergeChanges` deserializes plugin **update** responses before merging, the
  same as it already did for adds — sqlite returns dates as strings and they must not leak
  into tracked entities.

### 7. `freeze` did not freeze arrays — **FIXED**

Arrays are leaf properties in codegen, and `core/src/codegen/handlers/freeze/` had no array
handler, so `frozen.values.push(...)` mutated a "frozen" entity.

**Fix:** added `FreezeArrayHandler`, registered in `FreezeHandlerBuilder`. Pinned by
`core/src/schema/generators.test.ts` ("freezes arrays").

### 8. Views were never populated — **FIXED**

A view reported 0 records after its source collection was populated; the subscription also
over-notified (3+ fires per save).

**Fixes, in the order the doc prescribed:**

- View change-resolution works (a byproduct of #1/#6/#2 — postprocess no longer corrupts
  entities), so `View.ts` now **skips persisting** when the derived data already matches and
  **guards the subscription send** on non-empty changes, like `CollectionBase.saveChanges`.
- Broadcast channels are scoped by **schema + database identity** (`IDbPlugin.identity`,
  provided by `EphemeralDataPlugin` as the database name): two unrelated databases holding
  the same schema no longer see each other's notifications, which was both the
  over-notification and the cross-store event storm that starved view population in large
  test files. Same-database instances (other tabs) still share a channel.
- `FileSystemDbCollection.save` merges records already on disk before writing (adds-only
  persists skip `load()` and previously replaced the whole file with just the new adds);
  `MemoryDataCollection.addIfAbsent` supports hydrating around in-memory mutations.

The order-dependent `products view should update existing...` test is now independently
valid. `commentsView.test.ts` pins the notification contract at exactly
initial-result + one notification per save (matching `tasks.test.ts`; its previous
expectation of a single total call did not count the initial toArray delivery).

### 9. Subscribed queryables were not re-executable — **FIXED**

Calling a subscribed queryable's `count` twice applied the count option to the first call's
scalar result ("Cannot count resulting data, it must be an array").

**Fix:** `QueryOptionsCollection.snapshot()` captures/restores option state; every terminal
operation (`count`, `distinct`, `toGroup`, `first`, `firstOrUndefined`, `some`, aggregates,
`remove`) snapshots before recording its option and restores after execution, so the
queryable can be re-read as data changes. Pinned by `should bind count` in the memory and
file-system plugin tests.

### 10. `OptimisticUpdatesDbPlugin` removals never reached the read plugin — **FIXED**

After `removeAllAsync()` + `saveChanges()` the count was still 4.

**Cause:** removals *were* applied to the read plugin, but the next query saw an empty
collection with no hydration status and re-hydrated from the source — whose mirrored
removals were still in flight (`persistAckMode: "after-source"`) — resurrecting the
entities.

**Fix:** the plugin tracks collections it has written; the read plugin is authoritative for
them and they are never re-hydrated. The internal read `MemoryPlugin` also gets a unique
per-instance database name (the fixed shared name leaked data between unrelated source
databases in one process).

### 11. A persisted entity never went clean — **FIXED**

Found by the stress program (S1 mixed-batch churn), reduced to two entities and no volume.

Once an entity had been updated, it stayed dirty for the lifetime of the store. Three
symptoms, one cause:

- Update counts climbed save over save. Mutating one entity per save reported
  `aggregate.updates` of 1, then 2, then 3 — every previously-updated entity was re-sent.
- `previewChangesAsync()` never reached zero pending after a save, and an idle
  `saveChangesAsync()` loop reported `size: 1` forever.
- **A removed row came back.** Update an entity, save; remove it, save (count correct);
  then any later, unrelated save replayed the stale update and reinserted the row.

**Cause:** `afterPersist` calls `mergeChanges` then `clearChanges`, and neither reset the
tracked entity. `clearChanges` drops queued additions and removals only; the updates loop
in `mergeChanges` merged the plugin's response into the canonical document but left
`__tracking__.changes`/`original`/`isDirty` populated and the attachment's `changeType`
untouched. The adds loop already did the equivalent (`changeType: "notModified"`); the
updates loop never got it.

**Fix:** `markPersisted` in `datastore/src/change-tracking/ChangeTracker.ts` clears the
entity's accumulated edits and the attachment returns to `notModified` once its update has
been merged. The edits are dropped **in place** rather than by assigning a fresh
`__tracking__`: the proxy's `set` trap ignores writes to `__tracking__`, so the obvious
version is a silent no-op. Pinned by "stops reporting changes once its update has been
merged" in `ChangeTracker.test.ts`.

---

## Later defects (#12–#23) — all fixed

#12 and #13 were found by the stress program on 2026-08-02; both reduced to a single entity
with no volume and reproduced identically on the memory and file-system plugins. Both were
also independently fixed on the immutable `update()` path first (see
`specs/immutable-updates.md`), which was the evidence that they were proxy-*lifecycle* bugs
rather than save-pipeline bugs. The codegen fixes below (2026-08-03) close them on the
default proxy path too.

### 12. An array stops being change-tracked once its entity has been merged — **FIXED**

Silent data loss. An in-place array mutation made after the entity's first save is
discarded with no error and no failed assertion; the next read returns the old value.

**Reproduction** (`stress/src/s2-volume-wide-schemas.test.ts`, and reduced):

```ts
const [e] = await store.items.toArrayAsync();  // or: any entity, after one saveChanges
e.strings[0] = "changed";
await store.saveChangesAsync();                // aggregate.updates === 0
(await store.items.toArrayAsync())[0].strings[0];  // still "p"
```

Which paths keep tracking and which lose it:

| Entity came from | In-place array mutation tracked? |
| --- | --- |
| `schema.enrich(x, "proxy")` | yes |
| `addAsync`, before the first save | yes |
| `addAsync`, after the first save | **no** |
| a query | **no** |
| — whole-array replacement (`e.strings = [...]`), any path | yes (control) |

**Cause:** the root entity keeps its proxy — replacing the whole array is still detected —
but merge had NO array handler: arrays fell through to `MergePrimitiveHandler`, which emits
a plain reference assignment (`destination.values = source.values`), discarding the
destination array's tracking proxy. Both losing paths merge: `schema.merge` during
`afterPersist`, and the resolve of query results into an attached entity.

**Fix:** `MergeArrayHandler` (`core/src/codegen/handlers/merge/`), registered before the
primitive handler — it copies elements INTO the destination's existing array
(`length = 0`, then index-assign), preserving the proxy, keeping the caller's array
reference stable, and sharing no reference with the source. Two consequences landed with
it:

- `CloneArrayHandler` deep-copies per ELEMENT rather than `structuredClone` on the whole
  array — the array wrapper is now a live Proxy after merges, and a Proxy cannot pass a
  structured-clone boundary.
- Five plugin test suites carried a `QUIRK: should not update a nested array if it is not
  set through assignment` test that *asserted the buggy behaviour*; each is rewritten to
  assert the mutation is tracked and persisted.

Guarded by `"detects an in-place array mutation after the entity has been merged"` and the
re-query companion `"detects an in-place array mutation after a re-query has been merged
in"` in `ChangeTracker.test.ts`, plus the re-enabled `array-of-date` shape in S2.

### 13. Saving a mutation two or more levels deep throws — **FIXED**

Not silent — the save rejects with
`TypeError: Cannot read properties of undefined (reading 'inner')`, thrown from generated
code, so the stack points at `eval` rather than at the schema.

**Reproduction:**

```ts
const schema = s.define("x", {
    id: s.string().key(),
    nested: s.object({ inner: s.object({ value: s.string() }) }),
}).compile();

const [e] = await store.items.toArrayAsync();
e.nested.inner.value = "y";
await store.saveChangesAsync();   // throws
```

Depth 1 (`nested.value`) works; depth 2 and depth 3 both throw.

**Cause:** `__tracking__.changes` is a **flat** map keyed by dotted path —
`{ "nested.inner.value": "y" }` — but `getAttachmentsChanges` passes it to
`this.schema.serialize(...)`, which is generated against the *entity* shape and walks
`changes.nested.inner`. `changes.nested` is undefined, so depth 2 dereferences undefined.
Depth 1 survives only because it stops one level short.

The tracking itself was correct: `tracked.__tracking__.changes` held exactly
`{ "nested.inner.value": "after" }`. Only the serialization of the delta was wrong — and
worse than the throw suggested: depth 1 did not "survive", it silently produced a wrong
delta (`{ "nested": {} }`, the value dropped), masked only because JSON-column consumers
take values from the entity rather than the delta, and an in-place array mutation
serialized to an empty delta.

**Fix:** the proxy loop in `getAttachmentsChanges` routes through `serializeDelta`, which
now selects changed ROOT columns out of the already-preprocessed complete entity (no second
serialization pass) and resolves a dotted change key by its root segment
(`key.split(".")[0]`). A nested subtree is therefore always sent whole — which is what the
JSON-column consumers require — and the proxy and immutable delta paths are unified.
Guarded by `"serializes the delta for a mutation two levels deep"` plus depth-1 and array
companions in `ChangeTracker.test.ts`, and the re-enabled `object-depth-3` shape in S2.

### 14. `schema.serialize` throws on a partial entity with an absent nested parent — **FIXED**

Surfaced while making SQL plugins store nested objects as JSON. Patching only `tags` on a
schema that also declares `nested: { inner: ... }` threw
`TypeError: Cannot read properties of undefined (reading 'inner')` from generated code.

**Cause:** the generated serializer walks the whole entity shape, so a partial entity makes
it dereference branches the patch omits. This is the same blind spot defect #6 fixed for
`enrich` and `merge` via guarded selectors — the serializer never received them.

**The workaround was also not sufficient.** `ChangeTracker.serializeDelta` serialized the
COMPLETE entity and selected changed top-level keys — but the generated serializer's
`conditionallyCreateParent` only materialized the IMMEDIATE parent, never grandparents, so
any schema with an optional/nullable nested object at depth 2+ could not be serialized *at
all*, complete entity or not. That made #14 a live bug on the immutable path too, and the
one of the three tracker defects the immutable migration would not have retired.

**Fix:** exactly #6's treatment, applied to codegen. `emitDestinationAncestorGuards` in
`core/src/codegen/handlers/types.ts` is generalized to take a root (`"result"`) and
`useFromPropertyName`; the four serialize handlers (value, array, date, serializer) share
one `emitSerializeNestedAssignment` helper that reads the parent through an optional-chained
selector (`entity?.nested?.inner`) and materializes every `result` ancestor before
assigning. Selecting the delta out of the preprocessed entity (see #13) still stands — it
is the better shape regardless — but `schema.serialize` no longer throws on partial
entities either.

### 15. SQL plugins emitted a column per nested descendant — **FIXED**

`schema.properties` is flat (`nested`, `nested.inner`, `nested.inner.value`) and
`getResolvedName()` returns the LEAF name, so the SQL DDL built columns named `inner` and
`value` alongside `nested` — colliding the moment two nested objects share a child name, and
unbindable because the entity has no top-level `value` key. Nested objects were therefore
unstorable on SQL unless the schema hand-rolled
`.serialize(JSON.stringify).deserialize(JSON.parse)`, which is why every passing array test
on SQLite carried those modifiers and the gap stayed invisible.

**Fix:** `sqlColumnProperties` in `@routier/sql-plugin-core` — one column per ROOT property,
a nested subtree stored as one JSON column named for its root. DDL, INSERT column list,
INSERT params, UPDATE SET, and RETURNING all read from it. For a flat schema the output is
byte-identical, so nothing currently working changed.

Two follow-on rules landed with it, both load-bearing:

- **Encode on runtime shape, not declared type.** A delta has already been through
  `schema.serialize`, so a property with its own `.serialize()` arrives already-JSON;
  encoding by declared type double-encodes and the read side hands back a string.
- **For a JSON column the delta selects the column, the ENTITY supplies the value.** A
  nested subtree is one column, so writing the delta's partial subtree drops the siblings
  that did not change.

Pinned by `e2e/src/sqliteJsonColumns.test.ts` — a real SQLite file, a schema with no
serializers anywhere.

### 16. A `{ isPaused: false }` residue survived on non-proxy reads — **FIXED**

The enricher's pause bootstrap installs `__tracking__` on the **input** object; the deletion
at return targets the **output**. They miss each other, so `.immutable()` and `.diff()` reads
carry a stray `__tracking__` holding nothing but `isPaused`.

Harmless — it is non-enumerable and nothing reads it, and none of the state that decides what
a save persists (`changes`, `original`, `isDirty`) is present. Recorded because it is
confusing to find and trivially wrong.

**Fix:** the bootstrap is deleted for every mode except `"immutable"`, which never installs
one. Guarded by `"installs no __tracking__ bookkeeping at all"` in
`ImmutableCollection.test.ts`.

### 17. `"immutable"` change tracking did not freeze — **FIXED**

`SchemaDefinition.ts` builds an `if (changeTrackingType === "immutable")` block named
`"freeze"` — and **nothing ever fills it**. The mode has never frozen anything.

Consequence, and it is the one genuinely bad failure mode of the immutable path today: a
plain `entity.price = 5` is **silently lost**. It is not tracked (no proxy) and not rejected
(not frozen), so the write vanishes with no error. Freezing turns that into a throw, which is
the whole point.

`schema.freeze` already exists and works (`FreezeHandlerBuilder`, and defect #7 fixed its
array handler). It is simply never called from the enricher, so the fix is wiring rather than
new code — but it needs care: freezing on **add** would break `mergeChanges`, which writes
assigned identities back into the added entity. Freezing likely belongs on the read path only.

Measurement note: freezing is not a performance concern. Over 50,000 entities the frozen and
unfrozen non-proxy modes were within noise of each other (46.7ms vs 47.3ms on a re-read).

**Fix:** `QueryableExecutor.attachResults` freezes on the read path — deliberately not in
codegen, which would also freeze on add, where `mergeChanges` must write assigned identities
back into the entity it just persisted. Two consequences had to land with it:

- **Immutable reads adopt rather than merge.** Merging a re-read into the canonical instance
  writes into it, which is impossible once frozen. Adopting the fresh value is also the right
  semantics — an immutable read produces a new value and there is nothing to merge into.
- **A row changed through `update()` has its persisted value adopted in `mergeChanges`**, for
  the same reason.

Watch out for `TranslatedArrayValue.forEach`: it reassigns each slot to whatever the callback
returns, so it is a map-in-place, not a plain forEach. Refactoring that callback into a block
body that returns nothing leaves the plugin's own objects in the result array, and every later
mutation lands on something the change tracker has never seen — the save then reports zero
changes. That cost 13 sqlite tests during this fix.

Guarded by `"freezes what it returns"` and `"does not treat a plain mutation as a change"` in
`ImmutableCollection.test.ts`, plus the rewritten `plugins/memory/src/tests/immutableItem.test.ts`
(which had asserted the buggy behaviour — a bare mutation with no assertion at all).

### 18. Concurrent stores on one file-system database lose data — **FIXED**

Found by S5. Ten `DataStore` instances over one FileSystemPlugin database, each writing its
own key range: the union should be 200 rows and is **20** — exactly one store's worth. Nine
stores' writes are gone, silently, with every save reporting success.

**Cause** (sharper than first recorded — there was no per-instance cache at all):
`FileSystemPlugin.resolveCollection` constructed a FRESH, EMPTY collection on every persist,
and `save()` performed a non-atomic read-modify-write (`readFile` → mutate → `writeFile`)
with nothing serializing it. Ten concurrent savers all read the empty file and the last
`writeFile` won the whole file. Not even multi-instance-specific: two overlapping saves
through ONE plugin instance raced identically.

**Fix:** the same registry `MemoryPlugin` keeps, at the collection level — one
`FileSystemDbCollection` per (resolved database path, collection name), process-wide, in a
module-global map. Every writer mutates the shared in-memory view and stringifies it after
its own mutation, so any later write is a superset of every earlier one. With it:

- **Load-once.** The file is read exactly once per process (concurrent first loads
  coalesce on a waiter queue); after that the in-memory view is authoritative and the file
  is write-only. Re-reading on later saves would resurrect rows another writer removed.
- **Atomic writes.** Write-to-temp then `rename`, so a reader or a crash sees the old file
  or the new one, never a torn write.
- **The boundary, stated:** a file-system database belongs to ONE process. Rows written by
  another process after the first read are never observed. Cross-process sharing needs a
  real database.

The same shape still applies to any future plugin that persists a whole collection per save
rather than per row. Guarded by the `file-system` case of
`stress/src/s5-many-stores-one-database.test.ts`, no longer `knownFailing`.

### 19. An `s.array()` property cannot be written to PostgreSQL — **FIXED**

Found by S8. The first insert of an entity holding an array is rejected by the server:
`invalid input syntax for type json`. No workload runs; the row never lands.

**Reproduction** — two lines, one entity:

```ts
const schema = s.define('probe', { id: s.string().key(), values: s.array(s.string()) }).compile();
await store.rows.addAsync({ id: 'a', values: ['x', 'y'] });
await store.saveChangesAsync();   // rejected
```

**Cause:** the array is bound as a query parameter to a `json` column, and `pg` encodes a
JavaScript array as a *PostgreSQL array literal* (`{x,y}`), not as JSON. `{x,y}` is not valid
JSON, so the server rejects the value. The emitted SQL is correct; the parameter encoding is
not. A `json`/`jsonb` parameter has to be `JSON.stringify`-ed before it is bound.

Invisible to SQLite, which stores JSON as text and receives an already-serialized value.

**Fix:** one change with #20 — see there. The INSERT param builder routes every value
through `toColumnValueMap`, whose `needsJsonEncoding` JSON-stringifies structures bound to
JSON columns (encoding on runtime shape, so schemas with their own `.serialize()` are not
double-encoded). Guarded by `'writes an array property'` in
`e2e/src/postgresContainer.test.ts` and the re-enabled churn scenario in S8.

### 20. A nested object still emits a column per descendant on the PostgreSQL path — **FIXED**

Found by S8. This is the shape of defect #15, which was recorded as fixed. It was fixed for
SQLite; the PostgreSQL path still does it.

```ts
s.define('probe', { id: s.string().key(), nested: s.object({ value: s.string() }) })
// INSERT INTO "probe" ("id", "nested", "value") VALUES ($1, $2, $3)
//                                       ^^^^^^^  phantom column, parameter `undefined`
```

With unique names the extra column is merely spurious — the data round-trips correctly,
because `nested` carries the real value. It becomes data loss the moment a descendant shares a
name with a top-level property, because the statement then names one column twice and the
server rejects it: `column "value" specified more than once`.

**Reproduction:** a schema with both `value: s.string()` and `nested: s.object({ value: ... })`,
one entity, one save.

**Fix:** `plugins/postgresql/src/utils.ts` was only HALF migrated onto
`@routier/sql-plugin-core`'s column layer when #15 fixed SQLite — it used
`toColumnValueMap` on the UPDATE path but still iterated the flat `schema.properties` (and
used `p.name` instead of `p.getResolvedName()`) in the DDL, INSERT column lists, INSERT
params, and SELECT column lists. The fix is the port SQLite already carried:
`sqlColumnProperties(schema)` at every column-list site, resolved (storage-side) names
throughout, `toColumnValueMap` for INSERT params (which is also #19), and the hand-rolled
WHERE builder replaced with the shared `toSql(expr, 'postgresql')`. Two follow-ons landed
with it:

- **`RETURNING` rows are decoded** (`decodeJsonColumns`) before being echoed to
  `mergeChanges`, as `SqliteDbPlugin.collect` already did — without this the fix surfaces
  as a throw on the first nested read after a save.
- **`plugins/mysql/src/utils.ts` had the identical defects** at its corresponding sites
  (DDL, INSERT, SELECT); swept in the same pass.

Guarded by `'keeps a nested descendant distinct from a top-level property of the same
name'` in `e2e/src/postgresContainer.test.ts` and the matching S8 scenario.

### 21. The first concurrent write to a new collection loses all but one — **FIXED**

Found by S8. Five plugin instances over one database, each inserting into a collection whose
table does not exist yet: **one succeeds, four are rejected** with
`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`, and their rows
are gone. A second round, with the table now present, has all five succeed.

**Cause:** `PostgresDbPlugin` creates tables lazily — attempt the write, and on failure issue
`CREATE TABLE` and retry (`PostgresDbPlugin.ts` ~170–190). Nothing serialises that against
another connection doing the same thing, so four instances issue a `CREATE TABLE` for a table
the fifth is committing, and collide in the system catalog. The error surfaces as a failed
save rather than as a retry.

**The first-guess fix was already in place and insufficient:** the DDL already used
`CREATE TABLE IF NOT EXISTS` — which is NOT atomic in PostgreSQL against a concurrent
creator; two simultaneous creates still collide in the system catalog. The real gap was
that the savepoint from #4 wrapped the *write*, not the DDL, so a failed `CREATE TABLE`
had no recovery path and aborted the whole save.

**Fix** (`PostgresDbPlugin._doPersistWork`): the DDL runs inside its own savepoint; a
create failing with `42P07` (duplicate_table) or `23505` (the catalog collision) means the
other connection won and the table exists — roll back to the DDL savepoint and retry the
original write. Missing-table detection switched from `err.message` string-matching to
`err.code === '42P01'` (persist and query paths both).

**Why no other backend sees it:** in-process plugins have no DDL, and SQLite serialises writers
at the file level.

Note this is the *deployment* shape, not an exotic one — several processes starting against a
fresh database do exactly this. Guarded by the multi-instance scenario in
`stress/src/s8-real-databases.test.ts`, no longer `knownFailing`.

### 22. One save cannot update two entities whose changed columns differ — **FIXED**

Found by S8, and the broadest of the four: it needs no nested types, no arrays, and no
concurrency.

**Reproduction** — two entities, one save:

```ts
x.a = 'x-new';              // one changed column
y.a = 'y-new'; y.b = 99;    // two changed columns
await store.saveChangesAsync();   // rejected
```

`cannot insert multiple commands into a prepared statement`.

**Cause:** the builder groups updates by which columns changed and emits one `UPDATE ... SET
"col" = CASE "id" WHEN ... END WHERE "id" IN (...)` per group, then joins the groups with `;`
into a single parameterised query. PostgreSQL permits exactly one command per prepared
statement. SQLite's driver accepts multi-statement input, which is why every in-process run has
been green.

**What makes it dangerous:** the trigger is invisible at the call site. Nobody writes a
"heterogeneous update batch" on purpose — the groups diverge whenever one entity's new value
happens to equal its old one, so that property is not dirty and that entity lands in a
different group. This was found exactly that way: 50 churn targets, of which one already held
the value being written.

It also explains why S1's volume load passes against PostgreSQL: its `mutate` always writes the
same two properties, so every update falls into one group and one statement.

**Fix:** one query per group. `buildFromPersistOperation` returns `updates:
SqlOperation[]` — one entry per changed-column group, each numbering its own parameters
from `$1` — and the plugin pushes each group as its own operation into the already-flat,
sequential, per-savepoint execution list inside the one transaction. No new transaction
machinery was needed. Guarded by `'updates two entities whose changed columns differ in one
save'` in `e2e/src/postgresContainer.test.ts` and the matching S8 scenario.

### 23. Two identical unsaved rows with identity keys collapse into one — **FIXED**

Silent data loss on the add path, on every plugin. Adding two rows that are equal in content
to a schema whose key is an identity, in one save, inserts one row.

**Reproduction** — no volume, no update, no concurrency:

```ts
const schema = s.define('t', {
    id: s.string().key().identity(),
    name: s.string(),
    n: s.number(),
}).compile();

await store.items.addAsync({ name: 'b', n: 2 });
await store.items.addAsync({ name: 'b', n: 2 });
await store.saveChangesAsync();

await store.items.countAsync();   // 1
```

**Cause:** `UnknownKeyAdditions` (`datastore/src/change-tracking/additions/`) keys pending
additions by `schema.hash(entity, HashType.Object)` — a hash of the content with ids and
identities excluded. Two rows equal in content therefore hash equal, and the second `set`
overwrites the first. Identical rows are the *only* case, which is why nothing has hit it: the
rows differ in practice, and one differing property is enough.

**Why the key is a content hash at all**, which is what makes this awkward: `mergeChanges` has
to match each row the plugin returns back to the pending addition it came from, so it can
write the assigned identity into the caller's entity. An identity-keyed row has no id on the
way out, so content is the only thing the two sides share. With two identical rows there is
genuinely nothing to tell the returned rows apart — the correlation problem, not just the map,
is what needs replacing.

**Fix — neither of the directions first considered.** Correlating by position converts an
ordering assumption several plugins do not honor (mysql re-SELECTs, dexie's numeric-id
branch pushes in completion order, pouchdb re-fetches) into a load-bearing contract that
corrupts *silently* where the content hash at least throws loudly; a correlation token is
correct but touches every plugin's add path and `BulkPersistResult`. Instead the hash map
became a **multimap with take semantics**: `UnknownKeyAdditions.data` is
`Map<hash, entity[]>`, `set` pushes onto the bucket, and the correlation lookup — renamed
`take` on `IAdditions`, so the destructive semantics live in the type — removes and returns
one entry. Semantically sufficient, not a workaround: rows in one bucket are equal on every
hashed property and have no identity yet, so which returned row pairs with which pending
object is unobservable — but each caller's own reference receives an identity and both rows
insert. `replace` removes the caller's specific reference (identity `indexOf`), never the
whole bucket. No plugin-contract change, no ordering assumption, and the
`update()`-into-identical-row route is fixed by the same change.

One correction for the record: the "entire document must be returned for adds" rule lives
in the runtime assertion in `ChangeTracker.mergeChanges`, not in
`test-utils/src/pluginContract.ts` as this entry previously claimed.

**Found:** while adding unsaved-row support to the immutable `update()` path — a patch that
makes one pending row identical to another reaches the same collapse. The route is new; the
defect is not, and the guard is written against the plain add so it does not depend on
`update()` at all.

**Guarded by:** `'inserts two identical unsaved rows with identity keys as two rows'` and
`'assigns distinct identities to two identical unsaved rows'` in
`datastore/src/change-tracking/ImmutableUpdates.test.ts`.

### 24. A filtered subscription misses updates that remove a row from its result set — **FIXED**

Found in design discussion (2026-08-03), verified by test before recorded. A subscriber on
`where(t => !t.done)` renders active tasks; another component marks one done and saves. The
task should disappear from the subscriber's list — instead the subscriber was never
notified and kept rendering the stale row until an unrelated change fired the query.

**Cause:** `DataBridge.subscribe` match-checks changed rows against the subscription's
filter using their NEW values (seeded into an ephemeral memory db and queried). A row
*entering* the set matches; a *deleted* row matches by its final content; but a row updated
so it STOPS matching fails the check, so the subscriber's shrunken result set was never
re-queried. Enter notifies, delete notifies, leave-via-update was silent — the asymmetry
is the tell.

**Fix:** the subscriber's executor remembers the ids of its last delivered result
(`QueryableExecutor.captureDeliveredMembership`, fed from every delivery including the
initial one) and hands the bridge a membership getter. A changed row whose id is in that
set either changed or left — both re-query. Old values are never needed, which also keeps
the fix correct for diff-tracked collections where per-property history does not exist.
Cost: one `Set` per subscribed query (the size of its result) and one lookup per changed
row per save; the subscriber's callback still fires only when its data actually changed.

**Residue, documented:** membership is unknowable for scalar, aggregate, and projected
subscriptions (`count`, `min`, projections without the key), so those keep filter-only
matching — a `count` subscription can still miss a leave-the-set update. Recorded rather
than fixed: those results carry no ids to track, and the fix would be re-querying on every
update-bearing save.

**Guarded by:** `subscriptionMembership.test.ts` — full-array delivery on a matching
change, notification when a row leaves the set via update, and silence for updates to rows
that were never in the set.

## Later defects (#25–#26) — both fixed

Found 2026-08-04 by a browser workload built to stress replication
(`examples/sync-engine-dexie/browser/complex.ts`). Both were in `datastore`/core, not in the
replication plugins, and neither corrupted replicated data.

### 25. Mutating a pending addition before saving throws — **FIXED**

Every plugin. A save that has already written its data reports failure.

**Reproduction** — no volume, no concurrency, one collection:

```ts
const schema = s.define('t', {
    _id: s.string().key().identity(),
    name: s.string(),
    taskCount: s.number(),
}).compile();

const [project] = await store.projects.addAsync({ name: 'Project', taskCount: 0 });
project.taskCount = 4;                 // set a field derived from work that follows
await store.saveChangesAsync();        // throws TypeError: Cannot find internal addition
```

The row **is** persisted, with `taskCount: 4`. Only the post-save correlation fails, so the
caller sees a rejected save for a write that succeeded — the dangerous half.

**Cause:** the sibling of #23, same subsystem. `UnknownKeyAdditions` keys pending additions by
`schema.hash(entity, HashType.Object)` — a content hash, because an identity-keyed row has no id
on the way out and content is the only thing the two sides share. The hash is computed at
`addAsync` time, but the bucket holds the **live** entity: mutating it changes the content, so
`mergeChanges` re-hashes the returned document into a different bucket and `additions.take`
returns nothing.

**Why it has gone unnoticed:** the natural spelling is fine — pass the value to `addAsync` and
never touch the row. It needs a create-then-derive shape to trigger, which is exactly what a
"create the parent, count the children, write the count" flow produces.

**Note the asymmetry:** the immutable path already handles this. `ChangeTracker.updateImmutable`
checks `unsavedRows` and, for a pending row, replaces the addition outright — there is even a test
for it ("patches a pending addition in place of recording an update"). The proxy path has no
equivalent, so a proxy mutation leaves the index keyed by stale content.

**Fix:** `IAdditions.reindex()`, called once per save at the top of `prepareAdditions()` — the
moment before rows are handed to the plugin, so the keys describe exactly what goes over the wire.
`UnknownKeyAdditions` rebuilds its buckets from the entities' current content, reusing the same
references so `mergeChanges` still writes assigned ids into the caller's objects;
`KnownKeyAdditions` is a documented no-op, since its key is the row's own id.

The alternative — having the proxy re-key on write, mirroring `updateUnsaved` — was rejected as
more invasive for no benefit: it needs a hook in the proxy's `set` trap, on the hot path, to fix
something that only matters once per save.

Covered by five tests in `datastore/src/change-tracking/ChangeTracker.test.ts`, including the two
collision cases re-keying could plausibly break: two identical mutated rows staying distinct
(#23's guarantee), and a mutation that makes one pending row identical to another.

**Found by** the multi-collection browser workload in
`examples/sync-engine-dexie/browser/complex.ts`, which does exactly this in its seed.

### 26. A proxy collection's query results carry `__tracking__` — **FIXED**

Reading from a `proxy()` collection returns entities with an own, enumerable `__tracking__`
property holding the change tracker's state:

```json
{ "changes": { "name": "Project 1*" }, "isDirty": true, "original": { … }, "isPaused": false }
```

So `Object.entries(row)` and `JSON.stringify(row)` both include it. Anything that treats a query
result as data — a deep compare, a snapshot, forwarding the object to another API — sees internal
state. This is the same family as #16 (`{ isPaused: false }` residue on non-proxy reads, fixed);
the proxy path still leaks, and leaks more.

Replication is **not** affected: the wire bodies are built from prepared entities, and the POST
bodies observed in the demo are clean.

**Cause:** the proxy's `set` trap created the tracking object with a plain assignment, which is
enumerable. Both codegen bootstrap paths already used `Object.defineProperty(..., enumerable:
false)` — one for the enricher, with a comment explaining that computed properties may
`JSON.stringify` the entity and must not see it — so the lazy path, the one that runs on the first
real write, was the outlier.

**Fix:** `Object.defineProperty` in the `set` trap, and the same for the merge/pause bootstrap in
the codegen, which had the same plain assignment. Tracking is still reachable by name and still
drives the save path; it is now invisible to `Object.keys`, `JSON.stringify` and object spread.
Three tests in `ChangeTracker.test.ts`.

**Found by** the field-by-field audit in the same page, which reported five `__tracking__`
discrepancies against the server and nothing else.

### 27. A reversed null comparison matched every row — **FIXED**

`null == entity.deletedAt` rendered `$1 IS NULL` with a bound `null`. That is the tautology
`NULL IS NULL`: true for every row, independent of the column. The predicate did not error and
did not return zero rows — it returned *all* of them, so a filtered query silently became an
unfiltered one. `entity.deletedAt == null` rendered correctly, so the defect only appeared with
the operands the other way round.

**Cause:** `equalsNullColumnRight` in `plugins/sql-core/src/sql.ts` was written as a mirror of
`equalsValueColumnRight`, which is right for a binary comparison (`? = "col"` really is `"col" = ?`
reversed) and wrong for a null test, which has no mirrored form.

**Fix:** it now emits `"col" IS [NOT] NULL` and binds no parameter — byte-identical to
`equalsNullColumnLeft`. The sibling test that asserted `$1 IS NULL` (`sql.test.ts`) was rewritten
per the #3 pattern. A matrix covers both operand orders and both polarities on sqlite, postgresql
and mysql.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, High).

### 28. `"value" == entity.prop` rendered as `prop IS NULL` — **FIXED**

Worse than #27 and found while fixing it. Any equals comparison with the VALUE on the left and a
non-null value — `"Ada" == entity.name` — rendered `"name" IS NULL`, dropping the value entirely.
The comparison did not merely return the wrong rows, it tested a different column property.

**Cause:** a sentinel collision. `getPropertyValueSides` returned `null` to mean "this side is not
a value expression", but the equals renderer was written against an `undefined` sentinel
(`valRight !== undefined ? valRight : valLeft`). With the value on the left, `valRight` was the
absent-side `null`, which is `!== undefined`, so `value` became `null` and the null strategy ran.
A genuine `null` operand and an absent side were indistinguishable.

**Fix:** the absent-side sentinel is now `undefined`, which cannot be a legitimate operand.
`renderStringPatternComparison` moved to the same sentinel and rejects a null operand explicitly
rather than stringifying it into `LIKE '%null%'`.

**Found by** the all-dialect matrix written for #27 — the "still binds a parameter for a non-null
value in either order" control case, which existed only to prove the #27 fix had not over-reached.

### 29. Composite-key updates overwrote sibling rows — **FIXED**

Both SQL update builders matched rows on `schema.idProperties[0]` alone. For a schema keyed
`(tenant, id)`, updating `("acme", "shared")` emitted `WHERE "tenant" = ?` — which also matches
`("acme", "other")`. The grouped form was worse: `SET "a" = CASE "tenant" WHEN ? THEN ?` applied
one row's new values to every row sharing its first component. Rows affected was non-zero and no
error was raised. MySQL's select-back after an update repeated the assumption, so the echo
returned the wrong rows too.

**Cause:** `identityNames` (all id properties) already existed in both builders but was used only
to exclude ids from the empty-delta fallback; every WHERE and CASE used `idProperties[0]`.

**Fix:** single-key schemas keep the grouped-CASE statement unchanged — byte-identical output, the
existing tests pin it. Composite-key schemas take a new branch: one UPDATE per row with a full-key
WHERE, each its own operation, reusing the one-statement-per-operation shape from #22 rather than
dialect-specific row-value syntax (SQLite has none). Conditional (token-checked) updates AND every
identity column ahead of the token. Both operation types now carry a `keyTuples` field with each
row's full identity, and MySQL's select-back uses it as an OR of per-row conjunctions.
Thirteen tests in `updates.test.ts`, every one using rows that share their first key component.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, High).

### 30. browser-storage lost every persisted row on an add-only save — **FIXED**

The same defect as #18, in the other plugin that serializes a whole collection over one
value. Persist three rows, reload the page, add a fourth: the storage key now holds only the
fourth. Nothing errored — the add succeeded, and the rows it replaced were simply gone.

**Cause:** two halves that were each individually reasonable.
`BrowserStoragePlugin.resolveCollection` returned `new BrowserStorageCollection(...)` on
every call, so no state survived between operations; and `EphemeralDataPlugin` skips `load()`
for an add-only batch, because an add needs no prior state. Together, a fresh collection
holding one add serialized itself over the complete stored value in `save()`.

**Fix:** the file-system template, ported. A module-level registry returns one collection per
(Storage object, database name, collection name) — keyed by the Storage OBJECT as well, since
`localStorage` and `sessionStorage` can hold the same database name. `save()` hydrates first
when it has not loaded, merging with `addIfAbsent` so stored rows never clobber pending
mutations. `EphemeralDataPlugin`'s load-skip now carries a warning naming this exact trap,
since it has caused a data-loss defect in two separate plugins.

Also in this fix, from the same audit finding: an unparseable stored value now produces an
error that names the storage key, and is left in place rather than being reset to empty —
"recovering" by discarding turns data that could not be read into data that was deleted. An
empty-string value is tolerated as an empty collection. `JSON.stringify` moved inside the try
(a cycle previously threw past the callback), and the output is no longer pretty-printed,
which was doubling the bytes against a ~5MB quota.

**Not fixed, documented instead:** two tabs writing one database still race — each is an
independent read-modify-write owner of the key and the last save wins. CAS/revision is out of
scope; the single-writer boundary is stated in the plugin README.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, Critical).

### 31. Every SQLite query leaked a file handle — **FIXED**

`_doQueryWork` opened a `sqlite3.Database` per query and closed it only when a `shouldClose`
parameter was true. The parameter defaulted to false and the single caller never passed it,
so no query ever closed its connection. Nothing failed — a leaked handle still answers — it
just accumulated one open file per query for the life of the process.

**Fix:** `shouldClose` is gone. Every exit routes through one `finish()` that closes first, so
a path added later cannot forget. Deliberately still one connection per operation rather than
a long-lived shared handle: per-operation connections are what let SQLite's file locking
serialize concurrent writers, and a shared handle would make disposal every caller's problem.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, High).

### 32. A SQLite transaction that failed to begin ran anyway — **FIXED**

`db.run('BEGIN IMMEDIATE TRANSACTION')` was issued with no callback, so its error was
discarded. BEGIN IMMEDIATE is the statement that takes the RESERVED lock, and therefore the
one that fails with SQLITE_BUSY when another writer holds the file. On that failure execution
fell straight through to the batch, which then ran with **no transaction open**: a mid-batch
failure left the earlier writes committed, and the ROLLBACK on the error path had nothing to
undo. Partial saves, silently.

**Fix:** BEGIN takes an error callback and fails the save, matching how COMMIT was already
handled two lines below.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, High).

### 33. Two SQLite files sharing a collection name shared their DDL — **FIXED**

The CREATE TABLE cache was a module-global keyed by `schema.collectionName` alone. Two plugin
instances over different files with the same collection name served each other's statement, so
the second file's table could be created with the first schema's columns.

**Fix:** the cache is an instance field. The cost is re-deriving one string per collection per
plugin.

**Found by** the plugin production-readiness audit (`PLUGIN_AUDIT.md`, High).

### 34. An unopenable SQLite file hung the save and crashed the process — **FIXED**

Found while writing the test for #32. `new sqlite3.Database(file)` was called with no open
callback. When the open fails — a directory where the file should be, a permissions failure, a
missing parent — `sqlite3` reports it by emitting `error` on the Database object, which with no
listener attached Node throws as an uncaught exception, and *none* of the statement callbacks
queued against that handle ever fire. So the failure both crashed the process and left the
caller's `saveChangesAsync` pending forever.

**Fix:** opens go through `openDatabase(onOpenError)`, which supplies the callback and routes
the failure to `done`. Both work paths guard `done` behind a settled flag, since a failed open
and a failed statement can now both report (the #3 "calls done exactly once" pattern).

**Found by** the `it('fails the save when the transaction cannot begin')` test written for #32,
which timed out instead of failing — the test for one defect landing on another.

### 35. MySQL committed half a save whenever it created a table — **FIXED**

`ensureTable` ran from inside the transaction opened at the top of the save. MySQL commits
the open transaction *implicitly* when it executes DDL, so the first save to touch a new
collection committed everything written before it and continued in an untracked transaction.
A later failure in the same save then rolled back nothing — the partial write was already
durable, and the plugin still reported the save as failed.

**Fix:** table creation happens for every collection in the event BEFORE `beginTransaction`.
It is idempotent and independent of the batch's data, so it does not belong inside.

**Found by** the plugin production-readiness audit; guarded by
`e2e/src/mysqlContainer.test.ts` ("rolls the whole batch back when one row fails") and by the
five-instance S8 scenario, where racing table creation corrupts a *concurrent* writer's
rollback rather than only its own.

### 36. Four MySQL type mappings never round-tripped — **FIXED**

The plugin had never run against MySQL — everything it was judged on was a string-shape test
over its builders. Pointing the contract kit and a container suite at a real server failed 81
of 86 cases. Four distinct causes:

**Numbers arrived back as strings.** `s.number()` mapped to `DECIMAL(20, 10)`, and mysql2
returns DECIMAL as a string to preserve exact precision, so a saved `20` echoed as
`"20.0000000000"`. The echo no longer matched the pending addition and *every add* failed in
`mergeChanges` with "Cannot find internal addition". Now `DOUBLE` — the same reasoning that
moved PostgreSQL off NUMERIC in #4.

**Dates were rejected outright.** A serialized `s.date()` is ISO-8601, and MySQL's DATETIME
accepts neither the `T` separator nor the `Z` suffix ("Incorrect datetime value"). `SqlDialect`
gains an `encodeDate` hook — pass-through for the engines that accept ISO, and
`YYYY-MM-DD HH:MM:SS.mmm` in UTC for MySQL. The pool sets `timezone: 'Z'` to read them back
the same way, since mysql2 otherwise interprets DATETIME in the process's local zone and
shifts every date by the machine's offset.

**An absent optional property could not be bound.** mysql2 throws on an `undefined` parameter
where every other driver binds NULL, so an entity that merely omitted an optional field
failed to insert. Parameters now go through `bindable()`, which maps `undefined` to `null`.

**Booleans came back as 0 and 1.** MySQL's BOOLEAN is a synonym for TINYINT(1). The plugin
declares the column, so honouring its own DDL is its job: `decodeBooleanColumns` restores
them on both read paths, mirroring `decodeJsonColumns`.

### 37. MySQL's `count()` returned `[]` after `skip()` — **FIXED**

`count` was built by regex-replacing the SELECT list, which leaves the query's LIMIT/OFFSET in
place — so `OFFSET 1` skipped the single count row and the query returned nothing at all.
`countAsync()` handed back `[]` where a number belonged.

**Fix:** wrap instead of rewrite, `SELECT COUNT(*) FROM (<query>) AS count_subquery`. SQLite
already carried exactly this fix, with a comment explaining it; MySQL was written from the
older shape and never revisited. The regex was also fragile independently of the LIMIT bug —
`/SELECT .*? FROM/` matches inside a subquery and against a column named `from`.

### 38. A failed MySQL save could permanently cost the pool a connection — **FIXED**

The rollback path released the connection only if the rollback itself succeeded. A throwing
rollback skipped the release, so the connection was gone for the pool's lifetime; enough
failures deadlocked the plugin. The release moved into a `finally`.

**Found by** writing the pool-of-one failure-path case for the container suite.

### 39. PouchDB kept every plugin's state at module level — **FIXED**

The work queue, the index cache and the sync handle were module-level, so every
`PouchDbPlugin` in a process shared one database's state whatever its name. The sync handle
was the worst: it lived under the literal key `"sync"`, so only the FIRST plugin in a process
could establish replication and every later one silently received the first one's handle,
pointed at a different remote. The index cache was keyed by nothing at all, so the first
database's design document answered for every database. The queue serialized unrelated
databases behind each other.

The sync path also wrote a `{}` placeholder into the cache before doing its work, so if
constructing either database threw, the cache kept the placeholder forever and every later
call returned an empty object cast as a `Sync` — no replication, no error, no recovery
without restarting the process.

**Fix:** all three are instance fields, and the placeholder is gone. Seven tests in
`plugins/pouchdb/src/tests/isolation.test.ts` — none of which a single-store test could
have caught, which is how this survived a 119-case suite.

### 40. PouchDB replication was wired to a different database than the plugin's data — **FIXED**

`_doWork` built a fresh `new PouchDB(name)` per operation, and `sync()` built yet another one
of its own. Two PouchDB objects over one name behave as a single database only when the
ADAPTER broadcasts changes between them. IndexedDB does, which is why this ships and works in
a browser. Adapters that do not — the in-memory one, for instance — leave a live replication
unable to observe the plugin's own writes and the plugin unable to observe what replication
pulls in.

**Fix:** one local handle per plugin, used by every operation and by `sync()`, closed and
cleared by `destroy()`. It also removes a `new PouchDB` per operation.

**Found by** `e2e/src/couchdbReplication.test.ts`, the first time this plugin's sync path had
executed against anything.

### 41. PouchDB `destroy()` left replication running and the handle open — **FIXED**

`destroy()` called `_doWork` with `shouldClose: false`, so the database it opened to destroy
the database was itself left open, and a live sync kept polling the remote after the caller
had finished with the plugin.

Underneath that, `_doWork`'s close branch had no `return`: with `shouldClose` true it called
`done` synchronously AND again from the close callback. So the one caller that would have
exposed the double-callback was the one caller passing `false`.

**Fix:** `destroy()` cancels the retained sync handle, clears the index cache, and closes.
`_doWork` returns after the close branch — the "calls done exactly once" pattern from #3.

### 42. PouchDB asked for every added document twice — **FIXED**

Both bulk-add paths initialised `ids` from *every* response entry and then pushed each ok id
again, so `_bulkGetAdditions` received each id twice and the echo carried duplicates into the
change tracker. Two near-identical copies of the block, both fixed: `ids` starts empty and is
filled only from the ok entries.

### 43. `plugin.sync(store.schemas)` did not typecheck — **FIXED**

The documented call in `docs/.../pouchdb-sync` could not compile: `sync()` demanded a mutable
`SchemaCollection` while a store exposes `ReadonlySchemaCollection`. The plugin only reads the
schemas — it hands them to the caller's own event callbacks — so the parameter and the
callback signatures widened to the readonly type.

### 44. A Dexie save spanning two collections was not one transaction — **FIXED**

Each collection's writes were pushed into a `jobs: Promise[]` array and awaited with
`Promise.all`, so every collection got its own concurrent IndexedDB transaction. A save
across two collections could commit the first and fail the second: `saveChanges` reported
failure while half of it was already durable, which contradicts the datastore's own
all-or-nothing contract. The identity-add path also opened a *nested* transaction of its own,
so generated ids could survive a save that failed.

**Fix:** one `db.transaction('rw', [...every affected table])` per persist event, ordered
removes → updates → adds to match the SQL plugins, with the identity-add path inside it.

**Found by** the plugin production-readiness audit; pinned by "rolls the first collection back
when the second collection fails".

### 45. Dexie's schema cache was validated by counting entries — **FIXED**

`getSchemas` returned the cached stores whenever
`Object.keys(cached).length === event.schemas.size`, so two different schema sets of the same
size got the first one's index layout. The rebuild path compounded it by skipping any
collection name already present, so a *changed* definition for an existing name was never
re-derived. Either way the database's indexes stop matching its schema, with no error.

**Fix:** keyed by `dbName` and validated by a fingerprint — every collection name with its
full stores spec, sorted. Specs are always re-derived; the cache avoids repeating the string
work, it no longer decides what the schema is.

### 46. Dexie had no way to evolve a schema — **FIXED**

`db.version(1)` was hard-coded, and IndexedDB treats redefining one version with a different
index layout as an error rather than a migration. There was no supported way to add a
collection or an index to a shipped database.

**Fix:** `new DexiePlugin(name, { version })`, defaulting to 1. When Dexie rejects a layout,
its `VersionError`/`SchemaError` is rewritten into a message that names the database, the
version in use, and the option to raise — Dexie's own text mentions none of them. Dexie
absorbs purely ADDITIVE changes itself (it logs "Schema was extended without increasing the
number…" and adds the index); the message covers what it will not.

**Optimistic concurrency stays unsupported on Dexie** and is documented as a limitation
rather than implemented — there is no conditional-update primitive to build it on.

### 47. Dexie leaked a connection whenever setup threw — **FIXED**

`new Dexie`, `getSchemas` and `.stores()` all ran BEFORE the `try`, so a throw from any of
them escaped `_doWork` synchronously instead of reaching `done` — the caller saw a raw
exception rather than a failed event. The `catch` also called `done` without closing, so the
handle stayed open and blocked a later version upgrade of the same database.

**Fix:** all three inside the `try`, and `db.close()` on the error path.

### 48. Any paginated SWR read with `skip > 0` returned nothing — **FIXED**

`store.products.sort(p => p.price).skip(3).take(3).toArrayAsync()` through `HttpSwrDbPlugin`
returned `[]`. Not the wrong page — an empty one. `skip(0).take(n)` worked, so page one of
every list was fine and page two onwards was blank.

**Cause: the window was applied twice.** The client serialized `skip`/`take` into the GET
correctly, and the server answered that page correctly — both halves are asserted separately
so the failure localises. Then `onCacheMiss` answered the caller with
`swrStore.query(event, done)`, the *same event* with `skip` still on it, against a store that
by then held only the three rows just fetched. Skipping three of three leaves none.

**Fix: a predicate is idempotent under re-application; a window is not.** `filter` and `sort`
can be pushed to the server and applied again locally over the rows that come back, and the
answer is the same. A window cannot, because the local store is not the candidate set the
server sliced. So the window is no longer pushed down — `windowlessOperation` strips it — and
is applied exactly once, locally, when the caller's own read runs against the store.

The same windowless operation is used in three places that must agree on what set is being
described: the GET, the store read that a revalidate compares against, and the cache key.

**The trade, stated plainly:** the plugin syncs the whole filtered set rather than a page of
it. That is what a local-first cache is — it answers from rows it holds, and it cannot answer
a windowed query from a page it does not have. Callers who want the server to paginate and no
local copy should use `HttpDbPlugin` directly, which still pushes windows down.

### 49. A revalidate of one page deleted another page's rows — **FIXED**

Same root mismatch, and fixed by the same change. `classifyRevalidateChanges` computes removes
as "rows the store returned for this query that the server's response did not contain". With a
window on both reads those two sets described different slices, so revalidating page one
concluded page two's rows had been deleted server-side and removed them locally — while they
were still on the server. It also mis-classified: `adds` is "incoming not in existing", so
rows already stored but outside the window would have been re-added.

The cache key is now the candidate set rather than the window, so every page of one list is
one key, and the store comparison is windowless on both sides.

**Found by** the first tests to point a real server at the SWR read path
(`@routier/sync-server`), rather than a fetch mock driven by the client's own writes.

### The `--forceExit` question, answered

S5 also asserts directly against `process.getActiveResourcesInfo()` that ten stores with live
subscriptions release every handle they opened once each is unsubscribed, `destroyAsync`-ed
and `[Symbol.dispose]`-ed. **It passes** — no handles leak.

So the reason a stress run still needs `--forceExit` is NOT leaked subscription channels.
Something else in the suite holds the loop open; the memory-plugin `dbs` registry and the
sqlite driver are the obvious next suspects. Narrowed, not solved.

**Solved (2026-08-03). Neither suspect was right.** `npx jest` and
`STRESS=1 npx jest --selectProjects stress` both exit on their own now.

The thing S5 could not see is that a channel pair is opened **at construction**, one per
collection, whether or not anything ever subscribes. S5 only ever measured stores it had
already torn down correctly, so it proved teardown works — not that anything performs it.
`process.getActiveResourcesInfo()` on a bare store shows the shape plainly: two
`MessagePort` handles appear when the store is constructed and are still there after
`destroyAsync`.

Three causes, two of them production defects rather than test hygiene:

1. **`destroy` did not dispose the store.** It destroyed the database and left the store's
   channels open, while being the call that reads like teardown; only `[Symbol.dispose]`
   released them, and nothing said so. `DataStore.destroy` now disposes after the plugin
   callback returns — after, because disposing aborts the AbortController the destroy is
   running under.
2. **`HttpSwrDbPlugin` held the event loop open forever.** `startBackgroundSync` schedules a
   retry that reschedules itself, with no `unref` and no stored handle, so the chain
   outlived the plugin and nothing could stop it. Any *application* using that plugin could
   not exit either — the test suite is just where it was visible. Now unref'd, and stopped
   by `destroy`.
3. **`HttpSwrDbPlugin.notifySchemaSubscription` leaked a subscription per notification.**
   Creating a `SchemaSubscription` retains the shared channel, and this one was created to
   carry a single `send` and never disposed, so each revalidation raised the refcount
   permanently and the channel could never close.

The rest was test teardown: seven files constructed stores and never disposed them. The
per-file hunt is worth repeating rather than describing — run each test file on its own
without `--forceExit` and see which never exits. A file that leaks hangs outright; the
"worker failed to exit gracefully" warning only shows up in a multi-file run.

**An eighth file (2026-08-05).** `ChangeTracker.test.ts`'s defect-26 block constructed three
stores and disposed none, so `npx jest` still exited 0 while reporting a force-exited worker.
The per-file hunt above found it exactly as described: the file hangs on its own, and the
warning only appears in a multi-file run. Disposed in an `afterEach`; the whole suite now
reports nothing.

---

## Replication durable-queue re-enqueue — **FIXED** (2026-08-05)

The browser stress example (`examples/sync-engine-dexie/browser/complex.ts`) found a storage-engine
mismatch hidden by the unit suite. Repeatedly editing the same entity before its prior change had
flushed reuses the queue key `(collection, change kind, entity ids)`. `UnsyncedQueue.addMany` always
sent that row through `changes.adds`; MemoryPlugin treats add as an upsert, while Dexie's `bulkAdd`
is insert-only and rejected the second edit with:

```
ConstraintError: Key already exists in the object store
```

The local entity had already been persisted, but recording its new sync obligation failed. After
several cross-collection churns the queue reported zero pending while the audit found local/server
drift. Queue writes are now serialized, candidate rows are classified against durable queue state,
and an existing key goes through `updates` (`bulkPut`) rather than `adds`. A strict insert-only
store regression test covers the exact mismatch, and the Playwright workload now converges after
online churn, offline edits, reload, recovery, five repeated cross-collection saves, and rapid
multi-click churn.

---

## Contract-kit defects — **FIXED** (2026-08-02)

All four `knownFailing` entries are removed; the contract suites run their full sets.

| Defect | Plugin | Resolution |
| --- | --- | --- |
| Renamed properties lost on insert | sqlite | Column identifiers (DDL, INSERT/UPDATE/DELETE, SELECT lists) now use the storage-side name (`PropertyInfo.getResolvedName()`, `from ?? name`) — entities handed to `bulkPersist` are wire-shaped, so DDL and DML must agree on wire names. |
| `count()` after skip/take returns `[]` | sqlite (+ same bug in postgres) | `count` wraps the built query in a `COUNT(*)` subquery instead of regex-rewriting the SELECT, which left `LIMIT/OFFSET` applying to the single count row. |
| A save mixing add + update + remove does not apply all three | sqlite (+ same bug in postgres) | The persist loop grouped operations per schema and executed only one per group (`removes` else `updates` else `adds`). Flattened to one entry per operation, removes → updates → adds within a schema. |
| Two entities differing only in the second key component collapse | dexie | Dexie's primary key is the first entry in the stores string; multi-key schemas now emit a compound primary key (`[a+b]`) first. |

The contract kit itself is `test-utils/src/pluginContract.ts`. It supports three markers:
`knownFailing` (stable failure), `knownUnstable` (runs, failure warned not thrown — for
non-deterministic defects), and `skipSections`.

## Design-decision gaps — resolved (2026-08-02)

Decisions made and implemented:

- **Arrays are change-tracked.** In-place mutations (push/splice/index writes) mark the
  root dirty: arrays are wrapped in the tracking proxy with the root as parent
  (`EnrichmentArrayHandler`, `EnableChangeTrackingArrayHandler`). Pinned in
  `ChangeTracker.test.ts`.
- **Arrays serialize/deserialize per element.** Date elements become ISO strings on the
  way out and are revived on the way in; object elements are deep-copied; primitives are
  spread (`SerializeArrayHandler`, `DeserializeArrayHandler`). Serialized payloads are
  always plain arrays — also required because proxied arrays cannot pass structured-clone
  boundaries (BroadcastChannel).
- **Computed keys/identities are compute-once.** An existing value is carried into the
  enriched literal and never recomputed; identity-flagged computed props compute
  client-side like any computed key (the database cannot run the compute function).
  Non-key computed props keep recompute-per-enrich. Pinned in
  `core/src/schema/generators.test.ts`.
- **View subscription match-filtering stays as-is.** `DataBridge.subscribe` already
  match-checks filtered subscriptions before re-querying; unfiltered subscriptions
  re-query on any non-empty change. The stale comment promising more was removed.
- **`attachments.set` adopts the caller's instance.** An explicit set replaces a
  previously attached copy of the same entity (values authoritative, changeType carried
  over) — keeping the old copy canonical silently dropped the caller's subsequent
  mutations, which live views on a shared database can trigger nondeterministically.
  Pinned in `DataStore.integration.test.ts` and the cross-context attachment tests.

Still deliberately open:

- `SchemaTypes.Definition` handled as generic primitive everywhere.
- `EnrichmentObjectIdentityHandler` is an explicit "do nothing right now".
- Renamed KEY properties (MemoryDataCollection addresses records by in-memory key name).

---

## Packaging and lifecycle defects (#50–#54) — all **FIXED** (2026-08-06)

Found by installing the real tarballs into a clean project and running them, which nothing in
the repository had ever done. Every one of these is invisible to `npx jest`, because the test
suites import from `src/` and Jest supplies a module loader and a teardown that Node does not.

### #50 — six packages could not be `require`d on Node 18 or 20

`core`, `datastore`, `dexie`, `memory`, `pouchdb` and `replication` emitted ESM while their
manifests said `"type": "commonjs"`. `require()` worked only on Node 22, which supports
`require(esm)`. On Node 18 and 20 — both inside the range every README states — it threw
`ERR_REQUIRE_ESM`.

Reproduce on Node 22 with `node --no-experimental-require-module`, which restores the old
behaviour: `SyntaxError: Unexpected token 'export'`.

### #51 — six packages could not be imported by name

`browser-storage`, `file-system`, `mysql`, `postgresql`, `sql-core` and `sqlite` emitted
`commonjs2`, which Node's ESM interop exposes only as a default export. The
`import { MysqlDbPlugin } from '@routier/mysql-plugin'` written in their own READMEs bound
`undefined`.

**Fix for both:** `scripts/rspack.library.mjs` builds every package twice, ESM to
`dist/index.js` and CommonJS to `dist/index.cjs`, declared through `exports`.

### #52 — `@routier/pouchdb-plugin` could not be loaded in Node at all

`target: "web"` made Rspack resolve pouchdb's `browser` field and inline `index-browser.es.js`,
which reads `self` at module scope. Importing the plugin threw `ReferenceError: self is not
defined` in any Node process. Fixed by externalising dependencies, which leaves the driver's
own conditional exports to resolve at runtime where they can be resolved correctly.

### #53 — every bundle inlined its peer dependencies

`@routier/core` is a `peerDependency` of all eleven plugins, which is a promise not to bundle
it. Only `mysql` externalised it. A consumer of the datastore and two plugins loaded three
separate copies of core. Bundles ran to 1.4 MB; the same builds are now 1–45 KB.

### #54 — a program that finished its work never exited

A DataStore opens a BroadcastChannel sender and receiver per collection, and in Node an open
channel is a referenced handle. Any script that built a store and did not call `destroyAsync()`
ran to the end of its code and then hung forever — including the README quick start, which has
no `destroyAsync()` in it.

Jest never saw it: it tears down its own environment, so a referenced handle reads as a slow
exit rather than a failure. Fixed by `unref()`ing both channels, which is a no-op in browsers.
Pinned by `e2e/src/processExit.test.ts`, which runs a real script in a real process — the only
place this is observable.

---

## #56 — `npm run typecheck` overwrote every bundle — **FIXED** (2026-08-06)

Every package's `tsc` script was plain `tsc`, and every `tsconfig.json` sets `declaration`
and `outDir: ./dist` with no `noEmit`. Type checking therefore *emitted* — unbundled
JavaScript, on top of the Rspack output, in the same directory.

The gate order in `RELEASING.md` and in CI was build, lint, typecheck, test, pack-check. So
the artifact every later gate inspected was tsc's output, not the bundle that was built. A
publish immediately after a green run would have shipped `dist/index.js` containing
`export { DataStore } from './DataStore';` — an extensionless relative specifier that Node's
ESM loader rejects outright.

`pack-check` did not catch it: `main` points at `dist/index.cjs`, which tsc does not emit and
therefore did not overwrite. Half the package stayed correct, which is why `require` worked
and `import` did not.

Fixed by `tsc --noEmit` in all thirteen. Pinned by `scripts/consumer-check.mjs`, which found
it — running immediately after a typecheck, from a real install.

---

## #55 — the codegen breaks under any minifier — **DOCUMENTED CONSTRAINT** (2026-08-06)

`SchemaDefinition.ts:360` embeds `createChangeTracker.toString()` into generated source and
then emits a call to `createChangeTracker()` written as a literal string. A minifier renames
the declaration and cannot see inside the string, so the generated function throws
`createChangeTracker is not defined` the first time any schema is compiled.

Every rspack config used `mode: "development"`, which avoided this by accident. The shared
config sets `mode: "production"` with `optimization.minimize: false` and says why.

This is not fixed, only stated. Fixing it means the codegen must stop depending on identifier
names — emitting `${createChangeTracker.name}()` instead of a literal would survive
minification, because `.name` is renamed to match `.toString()`. Every generated call site
needs the same treatment before minification can be turned on.

---

## SQLite defects found by changing engine (#57–#59) — all **FIXED** (2026-08-06)

Making the plugin run in both Node and the browser meant running the same SQL through three
engines instead of one. Two engines disagreeing is the cheapest bug detector this repository
has; each of these had been passing every test for as long as the plugin existed.

### #57 — every query selected columns that do not exist

`buildFromQueryOperation` built its column list from `schema.properties`, which includes the
children of a nested object. Those children are not columns — the object is stored whole in
one JSON column. A schema with one nested object produced:

```sql
SELECT "_id", "name", "nested", "inner", "value", "count", "tags", "scores" FROM ...
```

naming three columns that do not exist. `sqlColumnProperties` — the helper for exactly this,
already imported in the same file — was not used. `buildSelectFromExpression` had it too.

It went unnoticed because `sqlite3` enables SQLite's double-quoted-string misfeature: an
unknown `"inner"` is silently reinterpreted as the string literal `'inner'`, so the query
returned three constant columns that the decoder ignored, and the tests passed.
`node:sqlite` compiles with `SQLITE_DQS=0` and reports it as the error it always was.

**Any engine with DQS disabled would have failed every nested-object query.**

### #58 — a parameterless read returned no rows

The WASM worker routed every statement with no parameters through `exec`, which reports
nothing. `SELECT * FROM users` takes no parameters, so it came back empty while the same
query *with* a parameter came back correctly. Queries now always prepare; `exec` is used only
for statements whose rows are not wanted.

### #59 — destroy silently did nothing from a cold start

The WASM driver unlinked through a cached OPFS pool handle, and the cache is populated by
`open`. A destroy that ran before any database had been opened — a test clearing state before
it starts, which is the common case — found the cache empty and unlinked nothing. It reported
success. `deleteDatabase` now installs the pool rather than reusing whatever is cached.

---

## #60 — a Dexie schema with two nested objects would not open — **FIXED** (2026-08-06)

`convertToDexieSchema` emitted the children of a nested object into the stores string as
though they were top-level properties. A root property is level 0 and its children are level
1, and the guard skipped only `level > 1`, so it caught grandchildren and nothing else.

`file: s.object({ key, size })` produced `++id,...,file,key,size`: two indexes on paths that
do not exist on the record, plus one on `file` itself, which IndexedDB cannot index because an
object is not a valid key.

Wasteful alone, fatal in pairs. Two nested objects sharing a child name — `original.size` and
`thumbnail.size`, which is what any schema with a file and its thumbnail looks like — emitted
`size` twice. IndexedDB refuses a duplicate index, so the database failed to **open**:

```
OpenFailedError: ConstraintError ... an index already exists and a request
attempted to create a new one
```

Every operation on that store failed, not merely an indexed query.

This is the same mistake as #57 in a different plugin: iterating `schema.properties`, which is
every property in the tree, where only root properties were meant. The SQL side has
`sqlColumnProperties` for exactly this; Dexie now tests `level > 0`.

Found by probing whether the planned blob/file plugin could store its reference on Dexie. It
could not, and nothing in the suite covered a schema with two nested objects.

---

## #61 — `tag()` on an object broke the entity's type — **FIXED** (2026-08-06)

`InferPrimitive` special-cases `SchemaObject` to unwrap its children into value types.
`SchemaTag<T>` carries the same `T` as whatever it wrapped without carrying which class that
was, so a tagged object fell through to the generic `SchemaBase` branch and the raw map of
child schemas came back as the type.

```ts
s.object({ key: s.string() }).tag('x')   // entity typed { key: SchemaString<string, never> }
s.object({ key: s.string() })            // entity typed { key: string }
```

Nothing failed at runtime — tags are metadata and the values were always correct. Only the
types lied, which is why it survived: every existing use of `tag()` was on a string or a
number, where `T` is already the value type and the bug is invisible.

Tagged arrays were wrong too, and differently: `SchemaArray`'s parameter is the ELEMENT schema,
so a tagged array inferred as neither the element nor the array.

Found by `@routier/blob-plugin`, which tags a file reference so a sweeper can find every
file-bearing property of a schema without being told where they are. Pinned by a test that
asserts a plain typed assignment for each of string, number, boolean, Date, array and object —
a regression fails to compile rather than failing at runtime.

---

## Orientation for a new session

**Where the test program lives**

| Path | What it is |
| --- | --- |
| `test-utils/src/shapeCatalog.ts` | 55 schema shapes × 4 property orders = 220 compiled schemas |
| `test-utils/src/generatorInvariants.ts` | 10 invariants × the catalog = ~2,100 cases |
| `test-utils/src/pluginContract.ts` | 62 behavioural tests every plugin must pass |
| `test-utils/src/queryOracle.ts` | 322 queries per plugin vs a plain-JS reference implementation |
| `e2e/` | SQLite durability; Postgres via testcontainers |
| `benchmark/` | Regression gates, 15% tolerance, `npm run benchmark` |
| `docs/mutation-backlog.md` | Mutation-testing triage and yield analysis |

**Two things that will mislead you**

1. **Queries fall back to in-memory filtering.** When the expression parser cannot handle a
   filter, the datastore evaluates it in JavaScript and returns correct rows. Behavioural
   query tests therefore cannot detect parser defects — they pass either way. Assert against
   `toExpression` directly when testing the parser. This is measured: a 50-test behavioural
   battery moved the mutation score 0.29 points; a 31-test direct battery moved it 3.74.

2. **`schema.clone` operates on application-shaped keys.** Cloning a wire-shaped object
   (post-`preprocess`) silently drops renamed properties. Use a plain structural copy when
   preparing test inputs, or you will misattribute the loss.

3. **A green SQLite run says almost nothing about PostgreSQL.** Defects #19 through #22 were all
   present while every SQLite suite was green, and each one is a place where SQLite is the more
   forgiving engine: it stores JSON as text (so a mis-encoded array parameter still round-trips),
   its driver accepts several `;`-joined statements in one call (so the multi-statement UPDATE
   works), and it serialises writers at the file level (so the create-table race cannot happen).
   Any change to the SQL builders or to parameter binding needs
   `STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress` before it is believed.

**Commands**

```
npx jest                                   # whole suite, ~50s, must exit 0
npx jest --selectProjects core             # one project
npm run mutate:expressions                 # mutation, ~8 min, gate 90%, currently 74%
npm run benchmark                          # perf gates against recorded baselines
E2E_CONTAINERS=1 npx jest --selectProjects e2e   # Postgres, needs Docker
```
