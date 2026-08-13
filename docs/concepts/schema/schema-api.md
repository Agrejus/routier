---
title: Schema API
---

# Schema API

This page is the compact, source-aligned reference for schema factories, modifiers, derived properties, and type inference.

## Factories

```ts
import { s, InferCreateType, InferType, SchemaTypes } from "@routier/core/schema";
```

| Factory | Value | Notes |
| --- | --- | --- |
| `s.string(...literals)` | `string` or a literal union | `s.string("draft", "live")` |
| `s.string({ maxLength }, ...literals)` | `string` or a literal union | Positive integer declaration; currently used by MySQL DDL, not runtime validation |
| `s.number(...literals)` | `number` or a literal union | `s.number(1, 2, 3)` |
| `s.boolean()` | `boolean` | May also use a generic constraint |
| `s.date()` | `Date` | Serialized by the selected plugin |
| `s.object({ ... })` | nested object | Children are schema properties |
| `s.array(property)` | array | Equivalent type shape to `property.array()` where available |
| `s.file()` | file input / `FileReference` output | Requires `BlobDbPlugin` to upload content |
| `s.vector(dimensions)` | `number[]` | Positive whole-number dimension declaration; used by `.nearest()` |
| `s.define(name, properties)` | schema definition | Finish with `.compile()` |

```ts
const articleSchema = s.define("articles", {
  id: s.string().key().identity(),
  status: s.string("draft", "published"),
  body: s.string({ maxLength: 4000 }).searchable(),
  embedding: s.vector(1536).optional(),
  attachment: s.file().nullable(),
  metadata: s.object({ source: s.string(), importedAt: s.date() }),
  tags: s.array(s.string()),
}).compile();

type Article = InferType<typeof articleSchema>;
type NewArticle = InferCreateType<typeof articleSchema>;
```

`InferType` is the read/entity shape. `InferCreateType` is the input shape and makes identities and defaults omittable.

## Modifier matrix

The fluent TypeScript API is authoritative: an unavailable combination does not expose the method. This matrix lists methods on the base property factories before another modifier narrows the chain.

| Modifier | string | number | boolean | date | object | array | file | vector |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `.from(name)` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `.optional()` / `.nullable()` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `.default(value, injected?)` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `.readonly()` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ |
| `.serialize()` / `.deserialize()` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `.array()` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| `.index(...names)` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `.distinct()` | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| `.key()` | ✓ | ✓ | — | — | — | — | — | — |
| `.identity()` | ✓ | ✓ | — | — | ✓ | — | — | — |
| `.foreignKey(schema, property)` | ✓ | ✓ | — | — | — | — | — | — |
| `.searchable()` | ✓ | — | — | — | — | — | — | — |
| `.tag(...tags)` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `.constrain<T>()` | ✓ | ✓ | — | — | — | — | — | — |

Modifier wrappers intentionally expose only valid next steps, so modifier order is not universally interchangeable. Let autocomplete guide the chain and keep key/identity/index declarations near the beginning.

## What each modifier means

- `.key()` identifies a row. Composite keys are made by marking more than one property.
- `.identity()` says storage supplies the value. On string keys, in-process plugins generate a UUID; database plugins may use their native identity behavior.
- `.foreignKey(schema, property)` records relationship metadata. It does not automatically join or cascade.
- `.from("stored_name")` maps the application property to a different storage field/column.
- `.default(value, injected?)` supplies omitted create values. A function runs for each created entity.
- `.optional()` allows omission/`undefined`; `.nullable()` allows `null`.
- `.readonly()` excludes later changes to the property.
- `.serialize(fn)` and `.deserialize(fn)` convert one property at the storage boundary. They are synchronous and limited to string/number storage values.
- `.index(...names)` declares backend indexes. Reusing a name across properties declares a compound index.
- `.distinct()` declares uniqueness; enforcement is plugin-dependent.
- `.searchable()` marks a string as eligible for a collection declared with `.fullTextSearch()`.
- `.tag(...tags)` adds property metadata for application/plugin inspection. It is unrelated to `collection.tag(value)`, which tags a pending operation.
- `.constrain<T>()` narrows TypeScript's type without runtime validation.

`maxLength`, literal lists, vector dimensions, and most schema declarations describe shape and storage. Routier is not a runtime validation library; backend constraints may reject invalid stored values.

## Derived and transformed properties

Use `.modify()` after `define()`:

```ts
const schema = s.define("orders", {
  id: s.string().key(),
  quantity: s.number(),
  unitPrice: s.number(),
  secret: s.string(),
}).modify(x => ({
  total: x.computed(order => order.quantity * order.unitPrice),
  persistedTotal: x.computed(order => order.quantity * order.unitPrice).tracked(),
  refresh: x.function(order => () => `/orders/${order.id}`),
  secret: x.transform({
    stores: SchemaTypes.String,
    to: value => encode(value),
    from: value => decode(value),
  }),
})).compile();
```

| Builder | Stored? | Purpose |
| --- | --- | --- |
| `x.computed(fn)` | No | Derive a value when an entity is enriched |
| `x.computed(fn).tracked()` | Yes | Persist a derived value so storage can filter/index it |
| `x.function(fn)` | No | Attach behavior to each entity |
| `x.transform({ to, from, stores, comparable? })` | Stored in transformed form | Two-way async or sync storage conversion of an existing property |

A transform must replace an existing property under the same name. `to` and `from` are live references and may be async. `stores` declares the storage type; `comparable` tells query translation which comparisons remain valid after transformation. See [Encryption](/integrations/plugins/built-in-plugins/encryption) for a packaged transform and [Files and Blob Storage](/integrations/plugins/built-in-plugins/files) for `s.file()`.

## Standard JSON Schema

A definition exposes Standard Schema JSON Schema metadata before compilation:

```ts
const definition = s.define("products", { id: s.string().key() });
const json = definition["~standard"].jsonSchema.input({ target: "draft-2020-12" });
const rehydrated = SchemaDefinition.fromJson(JSON.stringify(json));
```

Use `input()` for create shape and `output()` for read shape. `SchemaDefinition.fromJson()` returns an already compiled schema.

## Related

- [Creating a Schema](/concepts/schema/creating-a-schema)
- [Property Modifiers](/concepts/schema/modifiers/README)
- [Collection Configuration](/how-to/collections/configuring-collections)
- [Vector Search](/concepts/queries/vector-search)
- [Full-Text Search](/concepts/queries/full-text-search)
