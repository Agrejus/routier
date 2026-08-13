---
title: Joins
---

# Joining Collections

Pair rows from two collections on a matching key with `join` and `leftJoin`.

## Quick Navigation

- [A First Join](#a-first-join)
- [Left Joins](#left-joins)
- [Naming The Inner Side](#naming-the-inner-side)
- [What You Get Back](#what-you-get-back)
- [Working With The Pairs](#working-with-the-pairs)
- [Key Rules](#key-rules)
- [Joining A View](#joining-a-view)
- [Joining Across Stores](#joining-across-stores)
- [What A Join Costs](#what-a-join-costs)
- [Not Supported Yet](#not-supported-yet)
- [Related](#related)

## A First Join


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-1.ts


`s` is the store the collection belongs to. A store can see its own collections, so a sibling is
named once — and because the selector is checked against your store's type, a wrong name is a
compile error rather than a query that returns nothing.

Each result is a `[player, match]` pair — one for every match a player has. A player with three
matches appears three times; a player with none does not appear at all.

The two selectors name the key on each side. They must be single property paths, and they must
agree on type: joining a `string` key to a `number` key does not compile.

## Left Joins

`leftJoin` keeps rows from the left side that match nothing, pairing them with `undefined`:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-2.ts


The unmatched half is `undefined` — never an entity whose properties are all null.

## Naming The Inner Side

Two forms, and the difference is only which store the inner collection lives on:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-3.ts


The selector runs when the query is built, not when it executes, so it costs nothing and its
mistakes surface immediately.

## What You Get Back

A join returns **tuples**, and each half is a fully deserialized entity of its own collection:
dates are `Date`s, renamed columns carry their in-memory names, computed properties are present.

Two things follow from a tuple not being a row:

- **Results are read-only projections.** They do not attach to the change tracker, exactly like
  `map` results. Assigning to `player.name` on a joined pair changes nothing and saves nothing —
  read the row through its own collection to modify it.
- **Order is undefined without `sort`.** Backends pair rows in different orders, and that is the
  only difference between them you can observe. Sort when order matters.

## Working With The Pairs

Everything you chain after a join operates on the pairs:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-4.ts


A `where` after the join can compare the two sides to each other, which is the only place such a
condition can go:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-5.ts


A `where` **after** the join is split where it can be: any `&&` part of it that mentions one side
only also narrows that side's read, while the whole condition still decides the pairs. So
`([p, m]) => p.region === "east" && m.rank > 10` reads only eastern teams and only members above
rank 10, without you having to say so twice. A part naming both sides stays where it is, because it
cannot be answered by either read alone.

A `where` **before** the join filters the left side, and is pushed to the database the same way any
other filter is. Either place is correct; before the join is clearer when the condition is only
about the left side:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-6.ts


`count` counts **pairs**, not left-side rows:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-7.ts


The terminal methods available on a join are `toArray`/`toArrayAsync`, `first`/`firstAsync`,
`firstOrUndefined`/`firstOrUndefinedAsync` and `count`/`countAsync`. `sum`, `min`, `max`,
`distinct` and `toGroup` need one named field of one schema, which a pair is not — `map` to a
projection first and they are all available on it.

## Key Rules

| Rule | Behaviour |
| --- | --- |
| Equality | Strict `===` on the two key values, compared as entities. |
| Key type | Must be `string` or `number`. A `Date`, boolean or object key throws when the query is built. |
| Null keys | `null` and `undefined` match nothing. Under `leftJoin` the row still appears, paired with `undefined`. |
| Duplicates | Every matching pair is returned — two left rows sharing a key each pair with every matching right row. |
| Empty side | No pairs from `join`; every left row with `undefined` from `leftJoin`. |
| Scopes | Both collections are read under their own `softDelete` and `.scope()` filters. A soft-deleted row on either side is not in the results. |

A key selector has to be a property path — `p => p._id`, or `p => p.team.id`. Anything else throws
when the query is built rather than when it runs, because a join with an unusable key has no
partially-correct behaviour to fall back on. Conditions that are not key equality belong in
`where` after the join.

## Joining A View

A view is a join side like any collection:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-8.ts


## Joining Across Stores

Two collections on different plugins — a local cache and a remote store, two databases — join
normally:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-9.ts


Here the inner side is passed **directly** rather than selected. That is the one case the selector
cannot express: `s` is the store the query started on, and it has no way to reach outside it. Both
forms are accepted everywhere, so use whichever fits.

Neither plugin can read the other's rows, so Routier reads both sides and pairs them itself. The
results are identical; the cost is two round trips instead of one.

## What A Join Costs

The pairing itself is a hash join: one pass over each side, not a scan of one side per row of the
other. Where it happens depends on the backend, and it never changes the answer:

| Backend | How the join runs |
| --- | --- |
| SQLite, D1, PostgreSQL, MySQL | A real `INNER JOIN`/`LEFT JOIN`, done by the engine. |
| Memory, file-system, browser-storage | The plugin reads both collections and pairs them in memory. |
| Dexie, PouchDB, MongoDB | Each side is read through the plugin's normal query path — indexes and all — and paired in the plugin. |
| HTTP / replication | Two ordinary requests, one per collection, paired in the plugin. No server needs to know what a join is. |
| Two different plugins or stores | Routier reads both sides and pairs them itself. |

What a join **reads** is worth thinking about. With no filter on either side, both collections are
read in full. The filters that reduce that are the ones recorded before the join on the left side,
and the collection's own scopes on the right side; a `where` written after the join runs over the
pairs, so it narrows the result without narrowing the read.

One thing an engine-side join gets for free: a `sort`, `skip` or `take` recorded **before** the
join is applied to the left rows, not to the pairs. `.sort(...).take(2).join(...)` pairs the first
two left rows, on every backend — the same answer the in-memory join gives.

Where Routier can, it also narrows the right-hand read to keys the left side actually has, rather
than reading that collection whole. It stops doing so past `semiJoinKeyThreshold` distinct keys
(default 500), where a long key list costs more than the scan it saves:


<<< @/_snippets/code/from-docs/concepts/queries/joins/block-10.ts


Purely a cost knob — the pairs are identical either way.

## Not Supported Yet

- A join whose **right-hand collection has a scope on an unmapped or renamed property** is refused
  on SQL backends rather than pushed down: there is no column to compare, so the join would return
  rows that scope excludes. Nothing silently falls back — a wrong join is worse than a missing one.
- **The SWR plugin** (`HttpSwrDbPlugin`) refuses a join: it merges a local read with a remote one,
  and the two would disagree about whether a row is an entity or a pair. Use `HttpDbPlugin`.
- **Subscriptions** are not available on a join — the returned query has no `subscribe`.
- **Three or more collections** in one join, and `groupJoin`.

## Related

- [Filtering](/concepts/queries/filtering) — filter before the join to read less
- [Field Selection](/concepts/queries/field-selection) — project pairs into your own shape
- [Terminal Methods](/concepts/queries/terminal-methods) — how a query executes
- [Views](/concepts/data-collections/memory-collections) — views as a join side
