# Performance fixes v2: items D through H

This spec is the implementation guide for the audit items recorded in `specs/perf-fixes.md`
(New items D–H). It is self-contained: every change is written out, and every claim in it was
verified by an isolated test on 2026-08-13 before it was written down.

Read `specs/perf-fixes.md` Part 1 (environment traps) and Part 2 (measurement protocol) first.
Both apply. All line numbers were verified on branch `0.3.0` on 2026-08-13.

## What to implement, in order

1. Item D — fuse the ephemeral query scan. The only large win.
2. Item F — single-pass min/max.
3. Item H — cache root properties in `ChangeTracker`.

Implement one item at a time. Measure each per the protocol before you start the next.

Items E and G are in this document so you do not implement them:

- **Item E: DO NOT IMPLEMENT.** Measured at 1.77x in isolation, under the repo's ~2x bar.
- **Item G: DO NOT IMPLEMENT.** Profile-first investigation, reserved for a later session.

---

## Item D — Fuse the ephemeral query scan into one pass

### Problem

`EphemeralDataPlugin._query` (`core/src/plugins/EphemeralDataPlugin.ts:367`) walks the
collection up to four times per query and allocates a full-size array at each step:

1. `collection.records` spreads the WHOLE Map into a new array
   (`core/src/collections/MemoryDataCollection.ts:17-19`).
2. Each leading filter allocates another array: `source = source.filter(...)`
   (`EphemeralDataPlugin.ts:416-429`).
3. The clone loop walks the survivors again (`EphemeralDataPlugin.ts:431-436`).

Measured in isolation on 10k rows with two filters: 169µs per query as-is, 63µs fused — **2.7x**.

### Change 1: add an iterator to `MemoryDataCollection`

File: `core/src/collections/MemoryDataCollection.ts`. Add one method:

```ts
/** Iterates stored records without materializing them into an array. */
values(): IterableIterator<Record<string, unknown>> {
    return this.data.values();
}
```

Verified: no subclass (`FileSystemDbCollection`, `BrowserStorageCollection`) defines a member
named `values`. Do NOT remove or change the `records` getter — the durable subclasses serialize
`this.records` in `save()` (`FileSystemDbCollection.ts:148`, `BrowserStorageCollection.ts:122`).

### Change 2: fuse the scan in `_query`

File: `core/src/plugins/EphemeralDataPlugin.ts`. Replace the section from `if (source == null)`
(line 409) through the clone loop (line 436) with one pass.

Rules the replacement must follow:

1. Keep the key fast path above it untouched. When it produced a `source` array, iterate that
   array. When `source` is still null, iterate `collection.values()` — do NOT touch
   `collection.records`.
2. Hoist the usable leading filters once, before the loop. A leading filter option with
   `value.filter == null` is skipped today (line 418-420); skip it during hoisting.
3. Keep truthiness semantics. `Array.prototype.filter` keeps a row when the predicate returns a
   TRUTHY value, not `=== true`. The fused test must be `if (!kept) { skip }`, not
   `if (kept === false)`.
4. Keep the params form. A filter with params is called as `value.filter([record, value.params])`
   (line 428). A filter without params is called as `value.filter(record)`.
5. Clone survivors with the existing `cloneRecord` and push into the output array. Do not
   preallocate — the survivor count is unknown.

Replacement shape:

```ts
type LeadingFilter = { filter: (arg: unknown) => unknown; params: unknown | null };
const leadingFilters: LeadingFilter[] = [];

for (let i = 0; i < leadingFilterCount; i++) {
    const value = orderedOptions[i].value;

    if (value.filter == null) {
        continue;
    }

    leadingFilters.push({ filter: value.filter, params: value.params ?? null });
}

const cloned: Record<string, unknown>[] = [];
const filterCount = leadingFilters.length;

for (const record of (source ?? collection.values())) {
    let kept = true;

    for (let i = 0; i < filterCount; i++) {
        const { filter, params } = leadingFilters[i];

        if (!(params == null ? filter(record) : filter([record, params]))) {
            kept = false;
            break;
        }
    }

    if (kept === false) {
        continue;
    }

    cloned.push(cloneRecord(record));
}
```

Everything after the clone loop (`joinOption`, `outerKeys`, `resolveJoinInnerSide`, the
translator) reads `cloned` and stays unchanged. The old `source`-mutating filter loop and the
`length`/`Array.from` clone loop are deleted.

Note: the translator re-runs these same filter predicates over the survivors later. That is
today's behavior and it is correct (the predicates are pure). Do not try to remove the re-run —
that is item G, and it is out of scope.

### Change 3 (same mechanism, optional but recommended): the join inner side

`resolveJoinInnerSide` (`EphemeralDataPlugin.ts:329`) does `const stored =
innerCollection.records` and then loops over it — the same full-array spread. Replace with
`for (const record of innerCollection.values())` and keep the loop body (the `outerKeys` skip
and the clone-push) as it is.

### Interaction with Fix 4

`specs/fix-4-indexed-filtering.md` edits the same function: it adds an index path that sets
`source` to a resolved array, exactly like the key fast path does. The fused loop's
`source ?? collection.values()` is compatible with it in both orders. Before you start, check
whether the index path exists in `_query`; if it does, leave it intact — it is just another way
`source` becomes non-null.

### Tests and measurement

1. Full jest suite: the failing set must be identical before and after (perf-fixes.md
   section 1.3).
2. Benchmark per the protocol: `full-scan-10000`, `filtered-query-10000`,
   `renamed-full-scan-10000`, `renamed-filtered-query-10000`, plus `insert-1000` and
   `update-1000` (must not move — this change is read-path only).
3. Accept when the two filtered/scan scenarios improve and nothing else regresses beyond
   run-to-run spread. Isolation predicts a large win on the plugin section; the end-to-end
   scenario also contains attach and translate, so expect a smaller end-to-end percentage. If
   nothing improves, REVERT and record the numbers.

---

## Item F — Single-pass min/max in `JsonTranslator`

### Problem

`_minMax` (`core/src/plugins/translators/JsonTranslator.ts:322-333`) sorts the whole array and
takes element 0 — O(n log n) for an O(n) question, measured 200x slower than a single pass at
10k elements. It also MUTATES the array it was handed.

### Prior state (already done — do not redo)

The comparators in `min` and `max` were fixed on 2026-08-13, BEFORE this item: they used
subtraction, which is NaN for strings, so `min()`/`max()` on strings returned an arbitrary
element. They now use relational comparison with explicit null ordering (nulls first for `min`,
last for `max`), and the tests in `JsonTranslator.test.ts` pin the corrected behavior. Keep
those comparator functions EXACTLY as they are — this item changes only `_minMax`.

### The change

Replace the body of `_minMax`. Keep the method signature.

```ts
private _minMax<T extends string | number | Date>(data: unknown, name: string, sort: (a: any, b: any) => any): T {

    assertIsArray(data, this._formatDataNotArrayError(name));

    if (data.length === 0) {
        throw new Error("Cannot perform operation on empty array, result query contains no data")
    }

    let best = data[0];

    for (let i = 1, length = data.length; i < length; i++) {
        const value = data[i];

        // Array.prototype.sort moves undefined elements to the END without consulting the
        // comparator. Mirror that: undefined is never selected unless every element is.
        if (value === undefined) {
            continue;
        }

        if (best === undefined || sort(value, best) < 0) {
            best = value;
        }
    }

    return best as T;
}
```

Two parts of this shape are load-bearing:

1. Reusing the caller's comparator (`sort(candidate, best) < 0`) keeps `min` and `max` in one
   body and inherits the null ordering the comparators define.
2. The `undefined` skip is NOT optional. `sort()` never passes undefined to a comparator and
   moves it last; a single pass without the skip selects `undefined` as the minimum whenever the
   data contains one. This exact divergence was caught by the parity test below.

### Verified parity

A parity test on 2026-08-13 compared sort-take-first against this single pass, both using the
NEW relational comparators, on 12 input classes (numbers, negatives, Dates, equal Dates, strings
in both orders, null among numbers, null among strings, undefined among numbers, single element,
duplicates, all-null): **exact match on all 24 min/max cases.** Spot values: min of strings is
`"apple"`, min with a null is `null`, max with a null is the largest value.

### Tests and measurement

1. New regression test: after `min()`/`max()`, the input array's order is unchanged (the old code
   mutated it; the new code must not).
2. New tests: min/max over numbers and Dates, empty-array throw with the same message,
   single-element array.
3. No benchmark scenario covers min/max. Ship under the "unambiguously less work" rule
   (see New item B in perf-fixes.md for the precedent), plus run the standard benchmark set to
   confirm nothing else moved.

---

## Item H — Cache root properties in `ChangeTracker`

### Problem

`serializeDelta` (`datastore/src/change-tracking/ChangeTracker.ts:565-584`) rebuilds
`this.schema.properties.filter(p => p.parent == null)` on every call and then runs `roots.find`
per patch key. It runs once per CHANGED entity per save. `serializePrevious` (line 552) walks
`schema.properties` skipping non-roots — the same set — on every call.

### The change

File: `datastore/src/change-tracking/ChangeTracker.ts`.

1. Add three private readonly fields, built once in the constructor (the schema is fixed there,
   line 151-162):

```ts
private readonly rootProperties: PropertyInfo<TEntity>[];
private readonly rootsByName: Map<string, PropertyInfo<TEntity>>;
private readonly rootsByResolvedName: Map<string, PropertyInfo<TEntity>>;
```

```ts
// in the constructor
this.rootProperties = schema.properties.filter(p => p.parent == null);
this.rootsByName = new Map(this.rootProperties.map(p => [p.name, p]));
this.rootsByResolvedName = new Map(this.rootProperties.map(p => [p.getResolvedName(), p]));
```

`PropertyInfo` is exported from `@routier/core/schema` — extend the existing import at line 1.

2. In `serializeDelta`, delete the `roots` line and replace the lookup:

```ts
const property = this.rootsByName.get(rootKey) ?? this.rootsByResolvedName.get(rootKey);
```

⚠ Precedence must stay exactly this: the current code checks `p.name` across ALL roots first and
falls back to `p.getResolvedName()` across ALL roots. TWO maps preserve that. ONE combined map
does not — if some property's resolved name collides with another property's `name`, a single map
resolves to the wrong property. Do not merge them.

3. In `serializePrevious`, replace the loop header and drop the parent check:

```ts
for (const property of this.rootProperties) {
```

(The `if (property.parent != null) continue;` line is deleted — the cached array already
contains only roots.)

### Tests and measurement

1. Full jest suite unchanged — `previousValues.test.ts` and the change-tracking suites cover both
   methods directly.
2. Benchmark `update-1000` and `diff-update-1000`: accept neutral-or-better. The waste is small
   (only dirty entities pay it), so treat any measured regression as a mistake in the change,
   not as noise to argue with.

---

## Item E — `IdSet` allocation: DO NOT IMPLEMENT

Recorded in perf-fixes.md. Every keyed operation builds `new IdSet(...ids).toString()` —
allocation, `Object.freeze`, string build. A single-key fast path measured 79.6ns → 45.1ns:
**1.77x, below the ~2x bar**, so it will not show on the real path. It is written here so you do
not rediscover it. Skip it.

## Item G — Translator filter re-run: DO NOT IMPLEMENT

The translator re-runs leading filters the plugin already applied (see the comment at
`EphemeralDataPlugin.ts:413-415`). Removing the re-run needs a plugin→translator API change and
profile evidence that the pass costs anything. Neither exists yet. If you implemented item D you
already preserved the re-run; leave it alone.

---

## Acceptance for the whole spec

- Items D, F, H implemented, one at a time, each measured per perf-fixes.md section 2.2.
- Items E and G untouched.
- Jest failing set identical before and after each item.
- Results recorded under each item's heading in `specs/perf-fixes.md`, in the same format as the
  Fix 1–3 result blocks.
- `benchmark/baselines/baselines.json` NOT updated unless you are on the machine that owns it.
