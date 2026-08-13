---
title: Scope a collection (single physical store)
---

## Scope a collection (single physical store)

For single-table/collection backends (e.g., PouchDB, Local Storage), scope each collection so queries only return documents for that logical collection.

## Quick Navigation

- [Steps](#steps)
- [Runtime Scope + Inferred Types](#runtime-scope--inferred-types)
- [Why Use Scoping](#why)
- [Related Topics](#related)

### Steps

1. Add a tracked computed discriminator to your schema that stores the logical collection name (for example, `documentType`).
2. Apply a global scope when creating the collection so all queries are constrained to that discriminator.

<<< @/_snippets/code/how-to/collections/scope-single-db.ts

### Runtime Scope + Inferred Types

When the scope value is only known at runtime (for example, current `userSub`), initialize those collections in the constructor via factory functions.  
Use `ReturnType<...>` on the collection properties to keep the same inferred collection types you would get from direct property initialization.

<<< @/_snippets/code/how-to/collections/scope-runtime-param-factory.ts

### Why

This prevents cross-type collisions when multiple entity types share a single physical table/collection.

### Related

- Concepts: [Data Collections](/concepts/data-collections/memory-collections)
- Integration: [PouchDB Plugin](/integrations/plugins/built-in-plugins/pouchdb/README)
