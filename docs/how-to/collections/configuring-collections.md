---
title: Configuring Collections
---

# Configuring Collections

A collection declaration has three parts:

```ts
products = this.collection(productSchema)
  .scope((p, params) => p.tenantId === params.tenantId, { tenantId })
  .softDelete(p => p.deletedAt)
  .proxy()
  .create();
```

1. `collection(schema)` selects the schema.
2. Builder features and a change-tracking mode configure behavior.
3. `create()` constructs the collection.

There is deliberately no default mode: `create()` is unavailable until you choose one.

## Change-tracking modes

| Mode | Values returned by reads | How to update | Best fit | Trade-off |
| --- | --- | --- | --- | --- |
| `.proxy()` | Tracked proxies | Mutate properties, then save | Precise ordinary edits | Per-write proxy overhead; nested in-place mutations have limits |
| `.diff()` | Plain canonical objects | Mutate properties, then save | Proxy-free mutable models | Save compares snapshots and writes the whole changed entity |
| `.immutable()` | Deeply frozen values | `collection.update(entity, patchOrUpdater)` | UI/state architectures and safe stale references | Updates must use the collection API |
| `.readonly()` | Read-only collection surface | Not available | Reference data and read models | No add, update, or remove API |

```ts
class AppStore extends DataStore {
  proxied = this.collection(productSchema).proxy().create();
  diffed = this.collection(productSchemaV2).diff().create();
  immutable = this.collection(productSchemaV3).immutable().create();
  lookup = this.collection(countrySchema).readonly().create();
}
```

A store cannot contain two collections or views with the same compiled schema. Use separate schemas (or a separate store) when you need two configurations over one physical database.

### Choose `.readonly()` for read-heavy views

Change tracking is not free on reads. A tracked mode wraps every entity a query returns and attaches it to the change tracker, even when the caller only displays the rows. Measured against the SQLite plugin at 4,000 rows, a full read through a `.proxy()` collection took 12.1ms; the same read through a `.readonly()` collection took 8.3ms — attachment is roughly 30% of every tracked read.

Use `.readonly()` for dashboards, lists, search results, and any other surface that never saves what it reads. Keep `.proxy()`, `.diff()`, or `.immutable()` for the entities you mutate.

### Immutable updates

```ts
const current = store.products.update(product, { price: 12 });
const incremented = store.products.update(product, p => ({ ...p, stock: p.stock + 1 }));

store.products.current(product);   // latest generation of this row
store.products.isCurrent(product); // whether this reference is current
```

The entity argument only identifies the row. An updater receives the latest value, so a stale reference does not overwrite a newer update.

## Builder features

The following features work before or after the mode call. Their order does not change behavior.

```ts
// Equivalent builder order
this.collection(schema).scope(filter).audit(logSchema).derive(derive).proxy().create();
this.collection(schema).proxy().scope(filter).audit(logSchema).derive(derive).create();
```

| Feature | Purpose | Requirements |
| --- | --- | --- |
| `.scope(filter)` | AND a filter into every query | Plain or parameterized filter |
| `.softDelete(selector)` | Stamp instead of deleting and hide stamped rows | Nullable/optional `date` or `boolean` property; writable mode |
| `.audit(schema).derive(fn)` | Append caller-shaped audit rows during the same save | Audit schema; callback emits zero or more rows |
| `.fullTextSearch(options?)` | Maintain an index for `.search()` | At least one `.searchable()` string and one stable key |

Features compose. This is a supported declaration:

```ts
articles = this.collection(articleSchema)
  .scope((a, p) => a.tenantId === p.tenantId, { tenantId })
  .softDelete(a => a.deletedAt)
  .audit(articleAuditSchema)
  .derive((changes, emit) => emit(changes.map(change => ({
    id: crypto.randomUUID(),
    articleId: String(change.id),
    operation: change.operation,
    before: JSON.stringify(change.previous ?? null),
    after: JSON.stringify(change.delta ?? null),
    at: change.at,
  }))))
  .fullTextSearch({ stopWords: "english", minTokenLength: 2 })
  .immutable()
  .create();
```

### Scope

```ts
.scope(p => p.active === true)
.scope((p, params) => p.tenantId === params.tenantId, { tenantId })
```

Scopes apply to normal queries, joins when this collection is the inner side, search results, and subscriptions. Use them for tenant boundaries and for backends such as PouchDB that keep several logical collections in one physical store.

### Soft delete

```ts
const schema = s.define("products", {
  id: s.string().key(),
  deletedAt: s.date().nullable().default(() => null),
}).compile();

products = this.collection(schema).softDelete(p => p.deletedAt).proxy().create();
```

`removeAsync()` writes the current date (or `true` for a boolean property). The generated scope treats both `null` and a missing value as not deleted. To inspect deleted rows, open a separate store whose declaration omits `.softDelete()`.

### Audit

`derive` receives the complete batch for this collection once per save. Each change contains `collection`, `operation`, `id`, `entity`, `at`, plus `delta` and `previous` for updates. Call `emit(rows)` to append rows; emit nothing to skip the batch. Database-assigned IDs are unavailable for audit rows describing new entities.

Audit rows join the same persistence batch. They are atomic with the source changes only when the underlying plugin makes a save atomic.

### Full-text search

See [Full-Text Search](/concepts/queries/full-text-search) for search, tokenizer, score, repair, and key restrictions.

## Extending a collection

`create(factory)` receives the selected collection constructor and its dependencies:

```ts
products = this.collection(productSchema).proxy().create(
  (CollectionType, dependencies) => new ProductCollection(dependencies)
);
```

Your extension must extend the collection type selected by the mode. See [Extending Collections](/how-to/collections/extending-collections).

## Views use a different builder

```ts
activeProducts = this.view(activeProductSchema)
  .scope(p => p.tenantId === tenantId)
  .derive(emit => store.products.subscribe().toArray(rows => emit(rows.filter(p => p.active))))
  .create();
```

A view supports `.scope()`, `.derive()`, and `.create()`. It does not choose a tracking mode and does not support collection-only features. A view schema cannot use an identity key: use a known key for a materialized mirror, or a computed key for append-only history. See [Views](/how-to/collections/views).

## Store-wide options

```ts
super(plugin, {
  crossTabSync: false,
  semiJoinKeyThreshold: 250,
});
```

- `crossTabSync` defaults to `true`. Disable it only when no other tab or worker must receive save notifications.
- `semiJoinKeyThreshold` defaults to `500`. It controls when a join sends outer keys as an `IN (...)` prefilter; it changes cost, not results.
