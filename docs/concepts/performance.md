---
title: Performance
---

## Performance

Routier is fast because it does less work per row, not because it caches results. This page
names each optimization and what it costs.

### Measured numbers

These numbers come from the regression benchmark in `benchmark/`. It runs against the
`MemoryPlugin` on Node 22 and Apple Silicon. Each number is the median of repeated runs.

| Operation | Rows | Time |
| --- | --- | --- |
| Point lookup by key | 10,000 | 0.022ms |
| Count | 10,000 | 0.51ms |
| Filtered query | 10,000 | 5.2ms |
| Full scan | 10,000 | 11.5ms |
| Update | 1,000 | 3.0ms |
| Insert | 1,000 | 4.6ms |

Read these as relative costs, not as a promise. Your machine, your plugin, and your schema all
change the absolute time. A disk-backed plugin such as SQLite or IndexedDB pays I/O that the
memory plugin does not.

### Reads

**A key lookup does not scan.** Routier parses the filter expression. If the expression pins the
key to one value, Routier reads that record from a `Map`. The cost does not grow with the
collection. A point lookup in 10,000 rows takes 0.022ms.

**Filters run before copies.** Routier tests the stored record first. It copies only the rows
that match. A query that returns 10 rows out of 10,000 pays for 10 copies.

**Filter and copy share one pass.** Routier iterates the stored records once. It tests the
filters and copies the survivors in the same loop. It does not build an intermediate array for
each filter. This made `count` over 10,000 rows 1.43x faster.

**Routier generates the copy function from your schema.** It does not call `structuredClone`.
The generated function copies the exact properties the schema declares. On a five-property
schema the generated function takes 11ns per record against 885ns for `structuredClone` — 78x.

**Renamed properties get their own copier.** A property declared with `.from('unit_price')` is
stored under the storage name. Routier generates a second copy function that reads storage
names. Reads on renamed schemas used to fall back to `structuredClone`. They are now 2.2x to
2.8x faster and land within about 13% of an equivalent read on a schema with no renames.

**`min()` and `max()` make one pass.** They do not sort. They also do not reorder the array you
pass them.

### Writes

**Change tracking answers "did this change?" in about 31ns.** Routier proxies tracked entities.
The set trap compares the new value to the current value first. A write that does not change the
value stops there.

**Each tracked entity caches its tracking record.** A save over 100,000 attached entities that
changed nothing is 26x faster than it was without the cache.

**The change tracker computes its property list once.** It builds the root property list and its
name lookups when you construct the collection, not on every changed entity of every save. This
made a 1,000-row update 7.4% faster.

**Adds hash an entity once per operation, not twice.** Building the hash string costs about 7x
the map lookup it feeds.

**Keys use `crypto.randomUUID()`** where the runtime provides it. This made inserts about 17%
faster.

### The cross-tab option

Routier preprocesses every change and posts it to a `BroadcastChannel` on every save. This is
what makes live queries update in another browser tab. It runs whether or not another tab
listens.

If your app does not use cross-tab live queries, turn it off:

```ts
const store = new MyStore(new MemoryPlugin('my-db'), { crossTabSync: false });
```

Routier then skips the preprocessing when no local subscriber exists. Measured gains:

| Scenario | Gain |
| --- | --- |
| Diff-mode update, 1,000 rows | 19% |
| Insert, 1,000 rows | 10% |
| Update, 1,000 rows | 6% |

The option defaults to `true`, so existing apps keep cross-tab delivery. Set it to `false` only
when you accept that a change in one tab does not reach another tab.

::: warning
`crossTabSync: false` stops cross-tab delivery. Live queries inside the same tab still work.
:::

### What Routier does not do

- **Routier copies records on read.** It does not hand you a reference into its own storage.
  The copy is what makes change tracking safe. Routier makes the copy cheap; it does not skip it.
- **Routier does not cache query results.** Every query runs. Use the `CacheDbPlugin` if you
  want caching.
- **Routier does not index by default.** A filter on a non-key property scans. Declare an index
  when you filter the same property often.

### Keep queries parsable

Routier reads your filter expression to decide what the plugin can do. A parsable expression
becomes a key lookup, an index read, or a SQL `WHERE` clause. An expression Routier cannot parse
forces a full read and an in-memory filter.

Pass variables as parameters so the expression stays parsable:

```ts
// Parsable: the plugin gets the value.
store.products.where(([p, params]) => p.price > params.min, { min: 50 }).toArrayAsync();

// Not parsable: closes over an outer variable.
store.products.where(p => p.price > someOuterVariable).toArrayAsync();
```

See [Query Architecture](/concepts/query-architecture) for what each plugin translates.
