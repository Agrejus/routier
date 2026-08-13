---
title: Vector Search
---

# Vector Search

Declare a fixed-width embedding with `s.vector(dimensions)`, then use `.nearest()` to order rows by cosine similarity.

```ts
const documentSchema = s.define("documents", {
  id: s.string().key(),
  title: s.string(),
  published: s.boolean(),
  embedding: s.vector(1536),
}).compile();

class AppStore extends DataStore {
  documents = this.collection(documentSchema).readonly().create();
  constructor(plugin: IDbPlugin) { super(plugin); }
}

const similar = await store.documents
  .where(d => d.published === true)
  .nearest(d => d.embedding, queryEmbedding, 10)
  .toArrayAsync();
```

## Semantics

- `.nearest(selector, vector, count)` is an ordering plus a limit, not a filter.
- Results are closest first. Distance/score is not added to the entity.
- A preceding `where()` narrows the candidates; a following `take()` further limits the ranked result.
- The query vector must match the property's declared dimensions. Routier validates it when the query is built.
- The selector must name a vector property.

## Storage and fallback

All plugins can store vectors. A backend with native support may push the operation down; other backends store the numbers as JSON and score candidates in memory. The result semantics stay the same, but fallback reads every candidate selected before `.nearest()`.

PostgreSQL uses pgvector when the extension is available. Without it, it falls back to in-memory scoring. Keep a selective, pushable `where()` before `.nearest()` when the candidate set is large.

`dimensions` is a storage declaration, not per-save validation. A backend with a native fixed-width vector column rejects a mismatched stored value; JSON-backed plugins do not scan every write to enforce it.

## Property combinations

A vector supports `.from()`, `.optional()`, `.nullable()`, `.default()`, `.readonly()`, and `.tag()`. It is not a key, scalar index, distinct value, or full-text-search field.

```ts
embedding: s.vector(768).optional().readonly()
```

## Related

- [Query Overview](/concepts/queries/)
- [Filtering](/concepts/queries/filtering)
- [Schema API](/concepts/schema/schema-api)
