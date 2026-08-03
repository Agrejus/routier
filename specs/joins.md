# Join Support

Status: Proposal
Author: —
Date: 2026-07-31

## Summary

This spec adds equi-joins to the query API. A join combines two collections on a key pair, filters the pairs, and projects a result shape. The design reuses the existing expression parser, `QueryOptionsCollection` split machinery, and the plugin capability model. Every plugin supports joins from day one because the default execution runs in the datastore, not in the plugin.

## Goals

- Join two collections on equal key values (inner and left join).
- Filter joined pairs with the same `.where()` syntax collections use today.
- Sort, map, skip, take, and aggregate over joined pairs.
- Run against every existing plugin with no plugin changes (phase 1).
- Push work into plugins that can do it natively (phase 3).

## Non-goals (v1)

- Non-equi join conditions in the join itself. Put them in `.where()` after the join.
- Joins across more than two collections. Chain a second join in a later phase.
- Change tracking on join results. Join results are read-only projections.
- `groupJoin` (one-to-many pairs). This is a phase 4 candidate.

## API

```ts
// Inner equi-join: pairs where p._id === m.playerId
store.players
    .join(store.playerMatches, p => p._id, m => m.playerId)
    .where(([p, m]) => p.rank > 10 && m.won === true)
    .sort(([p, m]) => p.rank)
    .map(([p, m]) => ({ name: p.name, matchId: m._id }))
    .toArray(result => { ... });

// Left join: unmatched outer rows appear with undefined on the right
store.players
    .leftJoin(store.playerMatches, p => p._id, m => m.playerId)
    .toArray(result => { ... });
```

- `join(inner, outerKey, innerKey)` returns a queryable over `[TOuter, TInner]` tuples.
- `leftJoin(inner, outerKey, innerKey)` returns a queryable over `[TOuter, TInner | undefined]` tuples.
- Without `.map()`, terminators return the tuple pairs.
- The tuple destructuring in `.where()` mirrors the params-filter syntax: `([p, m]) => ...`.

### Why explicit key selectors

The C# LINQ `Join` shape (`inner, outerKeySelector, innerKeySelector`) beats a free-form predicate join for three reasons:

1. It guarantees an equi-join, so the default execution is a hash join — O(n + m), never a nested loop.
2. Key selectors are single property paths. The existing selector parsing in `QueryBuilderBase.getFields` already extracts them.
3. It maps 1:1 to SQL `JOIN ... ON a.x = b.y` and to future index lookups.

### Semantics

| Rule | Behavior |
| --- | --- |
| Key equality | Strict equality on the two key values after each side's value serializer runs. |
| Null keys | Rows with `null` or `undefined` key values never match. In `leftJoin` they still appear on the left. |
| Duplicates | Every matching pair appears. Two outer rows with the same key each pair with every matching inner row. |
| Change tracking | Off. Join results do not attach to the change tracker, same as `.map()` projections today. |
| Ordering | Undefined unless the query has a `.sort()`. |

## Execution model

Execution has three phases. Each phase ships alone and each phase is a fallback for the next.

### Phase 1 — datastore hash join

The datastore runs both sides as ordinary plugin queries, then joins in memory:

1. Run the outer side's query through the normal `DataBridge` path.
2. Run the inner side's query the same way.
3. Build a `Map` from key to rows on the smaller result set.
4. Probe the map with the larger result set and emit pairs.
5. Apply post-join options (`where`, `sort`, `map`, `skip`, `take`) with `JsonTranslator`.

This works against every plugin today because each side is a normal query. It also works when the two collections live in different datastores or different plugins — each side only needs to produce rows.

New pieces:

- `JoinQueryable<TOuter, TInner>` in `datastore/src/queryable/` — the tuple queryable. It accumulates post-join options in a `QueryOptionsCollection`, the same way `Queryable` does.
- A hash-join executor beside `QueryableExecutor`. It owns steps 1–5.
- Key selectors parse with the existing property-path extraction (`QueryBuilderBase.ts`). A selector that fails to parse throws at query build time. There is no closure fallback for keys because the join algorithm needs the key value, not a predicate.

### Phase 2 — pushdown via the expression tree

Two optimizations, both driven by the parsed filter expression:

**Conjunct splitting.** Split the top-level `&&` conjuncts of each post-join `.where()` tree. Classify each conjunct by the tuple element it references:

| Conjunct references | Runs |
| --- | --- |
| Outer properties only | In the outer side's plugin query |
| Inner properties only | In the inner side's plugin query |
| Both sides | Post-join in the datastore |
| Not parsable | Post-join in the datastore, with the original closure |

This reuses the database/memory split pattern from `QueryOptionsCollection.split()`. The pushed conjuncts reduce the rows each side loads; the post-join residue keeps the results exact.

**Semi-join key pushdown.** When the outer side's filters are selective:

1. Run the outer query first.
2. Collect the distinct join-key values from the outer rows.
3. Filter the inner query with `([m, p]) => p.keys.includes(m.innerKey)`.

The parser already produces a database-executable expression for the params-`includes` shape, so SQL plugins receive an `IN (...)` clause and the memory plugin prefilters before cloning. Apply this only below a key-count threshold (default 500) to keep `IN` lists bounded.

### Phase 3 — native plugin joins

Plugins that can join natively declare it through the capability model in `core/src/capabilities`:

- Add a `join` capability flag to the plugin capability set.
- Extend the query event payload with an optional join description: both schemas, the key property pair, the join kind (`inner` | `left`), and the pushed-down options for each side.
- SQL translators (`core/src/expressions/sql.ts`, plugin translators) emit `INNER JOIN` / `LEFT JOIN ... ON`.

The datastore checks the capability before building the plan. Plugins without the capability get the phase 1–2 path. This is the same pattern the database/memory execution split uses today: the plugin sees only what it declared it can handle.

### Phase 4 — candidates after v1

- `groupJoin(inner, outerKey, innerKey)` → `[TOuter, TInner[]]` tuples. The group machinery in `JsonTranslator.group` covers most of it.
- Joins inside `.subscribe()`. `DataBridge.subscribe` re-queries on change messages; a join subscription listens to both schemas and re-runs the join.
- Chained joins (three or more collections).

## Typing

```ts
join<TInner extends {}, TKey>(
    inner: CollectionRef<TInner>,
    outerKey: (outer: InferType<TOuter>) => TKey,
    innerKey: (inner: InferType<TInner>) => TKey
): JoinQueryable<TOuter, TInner>;
```

- `CollectionRef` is the public surface of a created collection — enough to build a query against it. Views qualify too.
- The key selectors constrain both sides to the same `TKey`, so mismatched key types fail at compile time.
- `JoinQueryable` exposes the same terminator set as `SelectionQueryable`, typed over the tuple.

## Failure modes

| Condition | Result |
| --- | --- |
| Key selector is not a single property path | Throw at query build time |
| Key property missing from the schema | Throw at query build time |
| Post-join filter not parsable | Runs post-join with the closure — correct, no pushdown |
| Inner side query fails | The terminator callback receives the error result |
| Key count exceeds the semi-join threshold | Skip semi-join pushdown, load the inner side with its own filters only |

## Performance expectations

- Hash join is O(n + m) over the loaded rows plus map overhead.
- Phase 1 loads both sides in full when no side filters exist. This matches what a hand-written `derive()` view does today, minus the manual bookkeeping.
- Phase 2 pushdown decides the real-world cost. A selective outer filter plus semi-join pushdown loads only matching inner rows.
- The memory plugin's key-equality fast path makes single-key probes O(1), which phase 2 can exploit for point joins.

## Open questions

1. Should `.map()` be required before terminators that persist or subscribe, to force an explicit shape? v1 answer: no, tuples are allowed everywhere.
2. Where does the semi-join threshold live — datastore option or per-query override? Proposal: datastore option, per-query override later if needed.
3. Do views expose enough surface to act as the inner side in phase 1? They should, since `derive()` already queries them.
