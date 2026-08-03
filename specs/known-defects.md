# Known defects

Status: 14 of 23 fixed. Open and pinned: #12, #13, #18, #19, #20, #21, #22, #23.
Open and worked around: #14.
Date: 2026-08-03

Defects 1–10 came from the functional test program. #11–#13 came from the stress program
(`stress/`, see `specs/stress-testing.md`) and are the reason it exists: all three are
change-tracker state bugs that a single-operation test cannot see, because each needs a
*second* save to become observable. #18–#22 came from the same program later, once it grew
scenarios for concurrency (#18, #21) and real databases (#19, #20, #22).

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

## Open defects

Both were found by the stress program on 2026-08-02, both reduce to a single entity with
no volume, and both reproduce identically on the memory and file-system plugins — so
neither is plugin-specific. Neither fix is contained (each is codegen work), so they are
pinned and recorded rather than fixed.

**Both are already fixed on the immutable `update()` path** (see
`specs/immutable-updates.md`). The same scenarios pass in
`datastore/src/change-tracking/ImmutableUpdates.test.ts` with no other change, which is the
evidence that these are proxy-*lifecycle* bugs rather than save-pipeline bugs. If that path
graduates and the proxies are removed, both entries close by construction rather than by a
targeted fix — so weigh a codegen fix here against just finishing that migration.

### 12. An array stops being change-tracked once its entity has been merged — **OPEN**

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
but the array's own tracking proxy is not reinstalled when the array is rebuilt. Both
losing paths rebuild it: `schema.merge` during `afterPersist`, and the enrich/resolve
performed on query results. This narrows the "Arrays are change-tracked" decision recorded
below: it holds only until the entity's first merge.

**Pinned by:** `it.failing("detects an in-place array mutation after the entity has been
merged")` in `ChangeTracker.test.ts`.

### 13. Saving a mutation two or more levels deep throws — **OPEN**

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

The tracking itself is correct: `tracked.__tracking__.changes` holds exactly
`{ "nested.inner.value": "after" }`. Only the serialization of the delta is wrong. A fix
needs either an un-flattening step before `serialize`, or a delta-shaped serializer that
walks dotted paths. Note that defect #1 fixed the same depth-2 blind spot in `enrich`; this
is the matching gap on the delta path.

**Pinned by:** `it.failing("serializes the delta for a mutation two levels deep")` in
`ChangeTracker.test.ts`.

### 14. `schema.serialize` throws on a partial entity with an absent nested parent — **OPEN, worked around**

Surfaced while making SQL plugins store nested objects as JSON. Patching only `tags` on a
schema that also declares `nested: { inner: ... }` threw
`TypeError: Cannot read properties of undefined (reading 'inner')` from generated code.

**Cause:** the generated serializer walks the whole entity shape, so a partial entity makes
it dereference branches the patch omits. This is the same blind spot defect #6 fixed for
`enrich` and `merge` via guarded selectors — the serializer never received them.

**Worked around, not fixed.** `ChangeTracker.serializeDelta` serializes the COMPLETE entity
(every nested parent present, so nothing absent is dereferenced) and then selects the changed
top-level keys. That is arguably better regardless — each value goes through its property's
real serializer rather than a partial reimplementation — but the codegen gap is still there
for any other caller who hands `serialize` a partial entity.

**Fix would be:** apply #6's `emitDestinationAncestorGuards` treatment to the serialize
handlers.

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

### 18. Concurrent stores on one file-system database lose data — **OPEN, pinned**

Found by S5. Ten `DataStore` instances over one FileSystemPlugin database, each writing its
own key range: the union should be 200 rows and is **20** — exactly one store's worth. Nine
stores' writes are gone, silently, with every save reporting success.

**Cause:** `FileSystemPlugin` rewrites the entire collection file from its own plugin
instance's in-memory view on every save, and `createShared(name)` gives each store a separate
plugin instance with a separate view. Instance B never observes A's writes, so B's save
overwrites them wholesale. Last writer wins the whole file.

The memory backend passes the same scenario, because `MemoryPlugin`'s `dbs` registry is
process-global by name — the ten stores genuinely share one collection object.

**Not obviously a bug to fix so much as a boundary to state.** Two honest options: document
that a file-system database belongs to one store per process (and make a second instance
fail loudly rather than corrupt), or give the plugin read-modify-write semantics with file
locking. The second is real work and platform-specific.

Worth noting the same shape would affect any future plugin that persists a whole collection
per save rather than per row.

**Pinned by:** the `file-system` case of `stress/src/s5-many-stores-one-database.test.ts`,
via the scenario harness's `knownFailing`.

### 19. An `s.array()` property cannot be written to PostgreSQL — **OPEN, pinned**

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

**Pinned by:** the churn scenario in `stress/src/s8-real-databases.test.ts`, and
`'rejects an array property'` in `e2e/src/postgresContainer.test.ts`.

### 20. A nested object still emits a column per descendant on the PostgreSQL path — **OPEN, pinned**

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

**Pinned by:** `'a nested descendant may share a name with a top-level property'` in
`stress/src/s8-real-databases.test.ts`, and the matching case in
`e2e/src/postgresContainer.test.ts`.

### 21. The first concurrent write to a new collection loses all but one — **OPEN, pinned**

Found by S8. Five plugin instances over one database, each inserting into a collection whose
table does not exist yet: **one succeeds, four are rejected** with
`duplicate key value violates unique constraint "pg_type_typname_nsp_index"`, and their rows
are gone. A second round, with the table now present, has all five succeed.

**Cause:** `PostgresDbPlugin` creates tables lazily — attempt the write, and on failure issue
`CREATE TABLE` and retry (`PostgresDbPlugin.ts` ~170–190). Nothing serialises that against
another connection doing the same thing, so four instances issue a `CREATE TABLE` for a table
the fifth is committing, and collide in the system catalog. The error surfaces as a failed
save rather than as a retry.

The fix looks contained: `CREATE TABLE IF NOT EXISTS`, plus treating a `23505` on the create as
"someone else won, retry the write".

**Why no other backend sees it:** in-process plugins have no DDL, and SQLite serialises writers
at the file level.

Note this is the *deployment* shape, not an exotic one — several processes starting against a
fresh database do exactly this.

**Pinned by:** the multi-instance scenario in `stress/src/s8-real-databases.test.ts`.

### 22. One save cannot update two entities whose changed columns differ — **OPEN, pinned**

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

**Fix direction:** issue one query per group rather than concatenating them, or build a single
statement covering all groups (every column in one `SET`, with `ELSE "col"` preserving the
untouched ones — which is already the per-group shape).

**Pinned by:** `'one save may update two entities whose changed columns differ'` in
`stress/src/s8-real-databases.test.ts`, and the matching case in
`e2e/src/postgresContainer.test.ts`.

### 23. Two identical unsaved rows with identity keys collapse into one — **OPEN, pinned**

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

**Fix direction:** correlate by position or by a per-add correlation token carried through
`preprocess` and returned by the plugin, rather than by content. That is a change to the
plugin contract (`test-utils/src/pluginContract.ts` documents the "entire document must be
returned for adds" rule this depends on), so it is not contained.

**Found:** while adding unsaved-row support to the immutable `update()` path — a patch that
makes one pending row identical to another reaches the same collapse. The route is new; the
defect is not, and the pin is written against the plain add so it does not depend on
`update()` at all.

**Pinned by:** `'collapses two identical unsaved rows with identity keys [pinned: known
defect #23]'` in `datastore/src/change-tracking/ImmutableUpdates.test.ts`.

### The `--forceExit` question, answered

S5 also asserts directly against `process.getActiveResourcesInfo()` that ten stores with live
subscriptions release every handle they opened once each is unsubscribed, `destroyAsync`-ed
and `[Symbol.dispose]`-ed. **It passes** — no handles leak.

So the reason a stress run still needs `--forceExit` is NOT leaked subscription channels.
Something else in the suite holds the loop open; the memory-plugin `dbs` registry and the
sqlite driver are the obvious next suspects. Narrowed, not solved.

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
