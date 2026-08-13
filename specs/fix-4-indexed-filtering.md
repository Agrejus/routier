# Fix 4: Index-aware filtering in the ephemeral store

Implement equality lookups on indexed fields in `EphemeralDataPlugin`. Today, a `where` on an
indexed non-key field scans the full collection. Only key equality has a fast path.

Read `specs/perf-fixes.md` Part 1 (environment traps) and Part 2 (measurement protocol) before
you start. Both apply to this work. All line numbers below were verified on branch `0.3.0` on
2026-08-13.

## Scope

In scope:

- Equality on ONE single-field-indexed property, when that equality is the whole expression of a
  leading filter.
- Indexed values of type string, number, or boolean.

Out of scope — do not build:

- Compound indexes.
- Range predicates (`>`, `<`, `startsWith`).
- Equality inside a compound expression (`&&` chains).
- Date-typed index values. `Map.get` compares dates by reference, so they stay on the scan path.

## The pattern to copy

The key fast path is the model. Read these before you write code:

- `core/src/plugins/EphemeralDataPlugin.ts:19-42` — `getKeyEqualityValue` parses a filter
  expression and returns a value only when the WHOLE expression is one non-negated equality on
  the key.
- `EphemeralDataPlugin.ts:395-407` — the query path calls it on each leading filter and swaps the
  scan source for a direct lookup.
- `EphemeralDataPlugin.ts:416-429` — all leading filters re-run over the swapped source. The
  predicates are pure, so the re-run keeps correctness for free. Keep this behavior.

## Step 1 — Index maps in `MemoryDataCollection`

File: `core/src/collections/MemoryDataCollection.ts`. Records live in `data: Map<idString,
record>` and are held in STORAGE shape.

Add per single-field index:

```ts
// columnName -> indexedValue -> set of idStrings
indexMaps: Map<string, Map<unknown, Set<string>>>
```

Rules:

1. Build each index map lazily, on the first query that asks for it, with one scan of `data`.
   Collections that never run an indexed query must pay zero maintenance cost.
2. After a map is built, maintain it incrementally in `add` (:126), `addIfAbsent` (:136),
   `update` (:159), `remove` (:154), and `seed` (:75). Clear all maps in `destroy` (:164).
3. In `update`, read the prior record from `data` FIRST and remove its old value from the index.
   Then insert the new value.
4. Read the indexed column with `property.getResolvedName()`, not `property.name`. Stored records
   use storage (`from`) names. See the same pattern at `EphemeralDataPlugin.ts:334`.
5. `addIfAbsent` must maintain the index. Durable subclasses (file-system, browser-storage)
   hydrate through it. If you skip it, the first indexed query after a restart returns partial
   results.

## Step 2 — Expression inspector in `EphemeralDataPlugin`

1. Write `getIndexedEqualityValue`, modeled on `getKeyEqualityValue`. Keep the same guards:
   comparator is `equals`, `negated` is not true, left is a property expression with no
   `transformer`, right is a value expression, `right.value != null`. Replace the
   `left.property.isKey` check: the property must carry a single-field index and must not be
   the key.
2. Resolve "has a single-field index" from `schema.getIndexes()` (`core/src/schema/
   SchemaDefinition.ts:884`). That function rebuilds its list on every call — cache the result
   per schema in the plugin.
3. In `_query`, after the key fast path misses (`source` still null), test each leading filter
   with the new inspector. On a hit: ask the collection for the id set, resolve each id through
   `data.get`, and use the resolved records as `source`. An empty or missing set means
   `source = []`, not a scan.
4. Do not change the filter re-run loop at :416-429. It runs all leading filters over the
   swapped source and keeps the result correct when the query has more predicates.

## Hazards

- **A stale index returns wrong rows silently, not as an error.** The tests in step 3 below exist
  for this.
- **`ConcurrencyDbPlugin` stores a hidden `__version` column on records.** Index maintenance must
  not touch record contents — it only maps one column's value to id strings. Run the optimistic
  concurrency test suites to confirm.
- **Writes to `__tracking__` and other traps** — read the "Traps" list at the end of
  `specs/perf-fixes.md` Part 4 before you touch these paths.

## Step 3 — Tests

1. Assert indexed-path results equal scan-path results for the same query after each mutation
   type: add, update that CHANGES the indexed value, update that keeps it, remove, seed.
2. Assert a query on an indexed field with zero matches returns empty, not a scan of everything
   (instrument or spy, do not infer from timing).
3. Add a schema with an indexed property to the shared plugin contract tests.
4. Run the optimistic concurrency suites (`OptimisticConcurrency.test.ts`,
   `wrapperStacking.test.ts`) unchanged.
5. Full jest suite: the failing set must be identical before and after (see perf-fixes.md
   section 1.3).

## Step 4 — Measure

Follow the per-fix procedure in `specs/perf-fixes.md` section 2.2. Additions:

1. Add an indexed non-key property to the benchmark schema in `benchmark/src/run.ts` and a
   scenario `indexed-filtered-query-10000` that filters on it with equality. Mirror how Fix 3
   added the `renamed-*` scenarios.
2. Measure `insert-1000` and `update-1000` on BOTH schemas: the unindexed one (must not move) and
   the indexed one (prices the maintenance).
3. Do not update `benchmark/baselines/baselines.json` unless you are on the machine that owns it.

## Acceptance

- The indexed equality query improves at least 5x over the scan path at 10k records.
- Writes regress less than 5 percent on the indexed schema, and not at all on the unindexed one.
- All tests in step 3 pass. The jest failing set is unchanged.
- If the read win does not reach 5x, revert and record the numbers under a "Result" heading in
  `specs/perf-fixes.md` Fix 4.

When the work is done, record the results under Fix 4 in `specs/perf-fixes.md`, in the same
format as the Fix 1-3 result blocks.
