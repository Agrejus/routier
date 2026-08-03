# Known defects

Status: 12 of 15 fixed; #12 and #13 open and pinned, #14 open and worked around (2026-08-02)
Date: 2026-08-02

Defects 1–10 came from the functional test program. #11–#13 came from the stress program
(`stress/`, see `specs/stress-testing.md`) and are the reason it exists: all three are
change-tracker state bugs that a single-operation test cannot see, because each needs a
*second* save to become observable.

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

**Commands**

```
npx jest                                   # whole suite, ~50s, must exit 0
npx jest --selectProjects core             # one project
npm run mutate:expressions                 # mutation, ~8 min, gate 90%, currently 74%
npm run benchmark                          # perf gates against recorded baselines
E2E_CONTAINERS=1 npx jest --selectProjects e2e   # Postgres, needs Docker
```
