# Known issues

Defects found while building the test program, each reproduced and diagnosed.

Every issue below is **also pinned as an `it.failing` test**, so the suite fails loudly the
moment one is fixed and the marker needs removing. Each test carries a comment pointing back
to its entry here. This document is the narrative; the tests are the enforcement.

`it.failing` inverts the usual meaning: the test **passes** while the defect exists and
**fails** once the behaviour is corrected. That is deliberate — it makes a fix impossible to
land silently.

Ordered by blast radius.

---

## 1. `enrich` corrupts objects nested two or more levels deep

**Severity: high — affects every change-tracked read.**

```
enrich({ id: "a", nested: { inner: { value: "deep" } } }, "diff")
  → { id: "a", nested: { inner: {} }, inner: { value: "deep" } }
```

Each nested subtree is written at the **root** under its leaf name and the true location is
emptied. Depth 3 compounds it: `{a:{b:{c:{d}}}}` → `{a:{b:{c:{}}}, b:{}, c:{d}}`.

`postprocess` is `deserialize` + `enrich`, so **every change-tracked query returns a
corrupted entity** for a schema with an object nested 2+ deep. Depth 1 is unaffected.
`clone`, `serialize`, and `deserialize` all handle these shapes correctly — the fault is
isolated to the enrichment generator's path assignment.

Pinned: `shapeCatalog.ts`, shapes `object-depth-2` / `object-depth-3`, invariant
`enrich-idempotent`.

## 2. Nested mutations are not tracked as dirty

**Severity: high — silent data loss.**

`tracked.text = "x"` marks the entity dirty. `tracked.nested.value = "x"` does not.
`hasChanges()` returns false, so **`saveChanges` silently discards the edit**. The change
tracking proxy is installed on the root object only.

Pinned: `datastore/src/change-tracking/ChangeTracker.test.ts`.

## 3. `TrampolinePipeline` never calls `done` when a processor errors

**Severity: high — hangs rather than fails.**

The trampoline catches the error, sets `_hasErrored`, and breaks out of the loop, with an
explicit comment that `done` is deliberately not called. Any caller awaiting that callback
**waits forever** instead of receiving a failure. This is the likely mechanism behind
`done()` timeouts seen in the replication suite.

The other half of the contract does hold: no processors run after the failing one.

Pinned: `core/src/pipeline/TrampolinePipeline.test.ts`.

## 4. PostgreSQL cannot create its tables on first use

**Severity: high — the plugin is unusable against a fresh database.**

`PostgresDbPlugin` creates tables lazily: attempt the write, run `CREATE TABLE` if it fails,
retry. That works outside a transaction. Inside the `BEGIN` it opens (~line 136) it cannot —
PostgreSQL aborts the whole transaction on the first error, so the `CREATE TABLE` (~173) and
the retry (~188) both return 25P02 "current transaction is aborted".

Every first write to a fresh database fails, and the error surfaced is the cascade rather
than the real "relation does not exist".

Fix: `SAVEPOINT` before the attempted write and `ROLLBACK TO SAVEPOINT` before the DDL, or
hoist the table check out of the transaction.

Pinned: `e2e/src/postgresContainer.test.ts` (gated on `E2E_CONTAINERS=1`).

## 5. `clone` destroys Dates inside arrays

**Severity: medium — data loss.**

`clone({ values: [Date, Date] })` → `{ values: [{}, {}] }`. Scalar Date properties clone
correctly; only array elements are affected.

Pinned: `shapeCatalog.ts`, shape `array-of-date`, invariant `clone-isolation`.

## 6. `enrich` and `merge` throw when a nested parent is absent

**Severity: medium.**

`TypeError: Cannot read properties of undefined (reading 'value')` from generated code that
assigns through `destination.nested.value` without creating `nested` first. Hits `merge`
into an empty destination and `enrich` on a sparse `{ id }` entity — the normal create path.

Pinned: `shapeCatalog.ts`, shapes `nested-default-child` (`merge-total`) and
`multi-mixed-modifiers` (`enrich-defaults`).

## 7. `freeze` does not freeze arrays

**Severity: medium.**

Root and nested objects freeze correctly, but `Object.isFrozen(entity.values)` is false and
`push` mutates a supposedly immutable entity. Affects `ImmutableCollection` and
`changeTrackingType: "immutable"`.

Pinned: `core/src/schema/generators.test.ts`.

## 8. Views are never populated

**Severity: medium.**

`productsHistory` reports 0 records after 2 adds. Reproduces on memory and file-system, so
the gap is in view/derive population, not one plugin.

Related: `View.ts` sends subscription changes unconditionally, unlike
`CollectionBase.saveChanges` which guards on non-empty changes. Adding that guard is **not**
a safe fix on its own — views resolve empty change sets, so guarding stops them populating
entirely and the `commentsView` test hangs. Fix view change-resolution first, then guard.

Temporarily deleting the failing view test exposed a second one — "products view should
update existing and not add a new record" — that had only ever passed because the failing
test ran first and populated the view as a side effect. On its own it reports 0 records where
it expects 2. It is kept as a normal `it` (it does pass in this file's order) but is marked
in-place as order-dependent, and it will start failing if the test above it is removed or
reordered.

Pinned: `plugins/memory` and `plugins/file-system` `products.test.ts`,
`plugins/memory/src/tests/commentsView.test.ts`.

## 9. Subscribed queryables are not re-executable

**Severity: medium.**

A subscribed queryable's query options mutate in place and are never reset, so a second
`count()` runs count over the first call's scalar result:
`JsonTranslator.count` throws "Cannot count resulting data, it must be an array". A
subscribed queryable exists to be re-read as data changes.

Pinned: `plugins/memory` and `plugins/file-system` `products.test.ts`, "should bind count".

## 10. `OptimisticUpdatesDbPlugin` removals never reach the read plugin

**Severity: medium.**

After `removeAllAsync` + `saveChanges`, the save reports all 4 removals but the count stays
at 4. Part of the in-progress sync engine.

Pinned: `plugins/pouchdb/src/tests/optimisticUpdates.test.ts`.

---

## Still pinned in configuration (not deleted)

These remain recorded as `knownFailing` entries in the contract kit, because removing the
entry makes the suite red rather than removing a test:

- **sqlite loses renamed properties on insert** — returns `label: null, amount: null`, so the
  add cannot be matched back to its canonical document.
- **sqlite `count()` after skip/take** returns `[]` instead of a number.
- **sqlite mixed add + update + remove** in one save does not apply all three.
- **dexie collapses composite keys** — two entities differing only in the second key
  component become one.

## Unmeasured

`codegen`, `plugins`, `collections`, and `datastore` mutation areas are configured but have
never been run. Given the catalog already found four codegen defects, expect a low score.
