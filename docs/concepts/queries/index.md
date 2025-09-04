## Queries

Routier queries are fluent and can only be performed through a collection. Build your query by chaining operations and finish with a terminal method to execute.

### Key points

- **Queries run via a collection**: `context.users.where(u => u.name === "James").firstOrUndefinedAsync()`
- **Chaining is lazy**: nothing executes until you call a terminal method like `toArrayAsync()` or `firstAsync()`.
- **Both async Promises and callback styles are supported** for all terminal operations.

### Basic querying

```ts
// All items
const all = await ctx.users.toArrayAsync();

// First item or undefined
const first = await ctx.users.firstOrUndefinedAsync();

// Does any record exist?
const hasAny = await ctx.users.someAsync();
```

### Filtering with where

```ts
// Simple filter
const james = await ctx.users.where((u) => u.name === "James").toArrayAsync();

// Parameterized filter
const withPrefix = await ctx.users
  .where((u, p) => u.name.startsWith(p.prefix), { prefix: "Ja" })
  .toArrayAsync();
```

### Sorting

```ts
// Ascending
const byName = await ctx.users.sort((u) => u.name).toArrayAsync();

// Descending
const newest = await ctx.users
  .sortDescending((u) => u.createdAt)
  .toArrayAsync();

// Multi-sort (applies in order added)
const sorted = await ctx.users
  .sort((u) => u.lastName)
  .sort((u) => u.firstName)
  .toArrayAsync();
```

### Selecting fields with map

```ts
// Single field
const names = await ctx.users.map((u) => u.name).toArrayAsync();

// Reshape into a custom object
const summaries = await ctx.users
  .map((u) => ({ id: u.id, fullName: `${u.firstName} ${u.lastName}` }))
  .toArrayAsync();
```

### Pagination

```ts
const page1 = await ctx.users.skip(0).take(10).toArrayAsync();
const page2 = await ctx.users.skip(10).take(10).toArrayAsync();
```

### Aggregation and set operations

```ts
// Count
const count = await ctx.users.countAsync();

// Min/Max/Sum over a numeric projection
const minAge = await ctx.users.minAsync((u) => u.age);
const maxAge = await ctx.users.maxAsync((u) => u.age);
const totalAge = await ctx.users.sumAsync((u) => u.age);

// Distinct values: project first, then distinct
const distinctAges = await ctx.users.map((u) => u.age).distinctAsync();
```

### Terminal methods (execute the query)

- **toArray / toArrayAsync**: return all results
- **first / firstAsync**: first item, throws if none
- **firstOrUndefined / firstOrUndefinedAsync**: first item or undefined
- **some / someAsync**: any match
- **every / everyAsync**: all match (evaluated client-side against the result set)
- **min/max/sum (and Async)**: numeric aggregations
- **count / countAsync**: count of items
- **distinct / distinctAsync**: unique set of current shape
- **remove / removeAsync**: delete items matching the current query

Example removal:

```ts
// Remove all inactive users
await ctx.users.where((u) => u.status === "inactive").removeAsync();
```

### Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object.
- To get distinct values of a specific field, use `map` to project that field before calling `distinctAsync()`.
- For live results, see Live Queries; you can chain `.subscribe()` before a terminal method to receive updates.

### Computed or unmapped properties

When filtering on a computed or unmapped property (not tracked in the database), the filter runs in memory. If you start your query with only computed/unmapped filters, the system will load records first and then apply those filters client‑side.

Best practice: apply database‑backed filters first, then computed/unmapped filters. This minimizes the number of records that need to be loaded into memory.

Example (in this schema, `firstName` is stored in the database while `age` is a computed property):

```ts
// Good: DB filter first, then computed filter (runs remaining in memory)
const found = await ctx.userProfiles
  .where((u) => u.firstName.startsWith("A")) // database-backed
  .where((u) => u.age === 0) // computed (in-memory)
  .firstOrUndefinedAsync();

// Avoid: starting with a computed filter can lead to a broader load before filtering in memory
const avoid = await ctx.userProfiles
  .where((u) => u.age === 0) // computed (in-memory)
  .where((u) => u.firstName.startsWith("A")) // database-backed
  .toArrayAsync();
```

### Related

- [Expressions](/concepts/queries/expressions/)
- [Query Options](/concepts/queries/query-options/)
