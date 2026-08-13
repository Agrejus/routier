---
title: Performance
---

## Performance

Routier is fast because it does less work per row, not because it caches results. This page
names the work it does, the work it avoids, and how each one scales.

What an operation costs on your app depends on your machine, your plugin, and your schema. A
disk-backed plugin such as SQLite or IndexedDB pays I/O that the memory plugin does not. To
measure your own workload, run the regression benchmark in `benchmark/`.

### Reads

**A key lookup does not scan.** Routier parses the filter expression. If the expression pins the
key to one value, Routier reads that record from a `Map`. The cost is the same at 100 rows and
at 1,000,000.

**Filters run before copies.** Routier tests the stored record first. It copies only the rows
that match. A query that returns 10 rows out of 100,000 pays for 10 copies. The copy cost scales
with the size of the result, not the size of the collection.

**Filter and copy share one pass.** Routier iterates the stored records once. It tests every
filter and copies the survivors in the same loop. It does not build an intermediate array per
filter, so a query with three filters still walks the collection once.

**Routier generates the copy function from your schema.** It does not call `structuredClone`.
The generated function copies the exact properties the schema declares, in a straight line, with
no reflection at read time. On a five-property schema it is 78x faster per record than
`structuredClone`.

**Renamed properties get their own copier.** A property declared with `.from('unit_price')` is
stored under the storage name. Routier generates a second copy function that reads storage
names. A schema that renames properties reads at close to the speed of one that does not — the
difference is about 13%.

**`min()` and `max()` make one pass.** They read each element once. They do not sort, so their
cost grows linearly with the array, not by `n log n`. They also do not reorder the array you
pass them.

**A count does not build entities.** `count()` returns a number, so Routier never turns the
matching rows into tracked entities. Building entities is the largest part of a read, which is
why a count over a collection costs a fraction of a full read of it.

### Writes

**A write that changes nothing stops early.** Routier proxies tracked entities. The set trap
compares the new value to the current value first. Assigning a property its current value costs
a comparison, and nothing else.

**How change detection scales depends on the tracking mode you chose.** In `proxy` mode, the
entity records its own writes, so a save reads one cached flag per attached entity. A save that
changes nothing stays cheap as the attached set grows. In `diff` mode, Routier hashes each
attached entity against the baseline it took at attach time, so a save costs more as the
attached set grows, even when nothing changed. Prefer `proxy` when you attach many entities and
change few.

**The change tracker prepares once, not per entity.** It builds its property list and name
lookups when you construct the collection. A save does not rebuild them for every changed
entity.

**Keys use `crypto.randomUUID()`** where the runtime provides it, instead of building a UUID in
JavaScript.

### The cross-tab option

Routier preprocesses every change and posts it to a `BroadcastChannel` on every save. This is
what makes live queries update in another browser tab. It runs whether or not another tab
listens.

If your app does not use cross-tab live queries, turn it off:

```ts
const store = new MyStore(new MemoryPlugin('my-db'), { crossTabSync: false });
```

Routier then skips the preprocessing when no local subscriber exists. On write-heavy workloads
this removes 6% to 19% of the total save time, depending on how much the save changes.

The option defaults to `true`, so existing apps keep cross-tab delivery.

::: warning
`crossTabSync: false` stops cross-tab delivery. A change in one tab does not reach another tab.
Live queries inside the same tab still work.
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
