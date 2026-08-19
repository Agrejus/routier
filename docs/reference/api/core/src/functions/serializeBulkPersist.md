[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / serializeBulkPersist

# Function: serializeBulkPersist()

> **serializeBulkPersist**(`changes`, `schemas`): [`SerializedPersistRequest`](../type-aliases/SerializedPersistRequest.md)

Defined in: [core/src/plugins/wire/persist.ts:23](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/persist.ts#L23)

Saves, in the form that survives a wire.

Simpler than a query, because a change set holds no functions: adds, updates and removes are
entities, and an entity reaching a plugin has already been through `preprocess` — so it is in
STORAGE shape, where a Date is already an ISO string and a nested object is already whatever the
schema said to store. It is JSON by the time it gets here.

Two things are deliberately left behind:

- **Tags.** `SchemaPersistChanges.tags` is caller-side metadata for correlating a save with its
  echo locally. The receiver has no use for it and no business seeing it.
- **Schema ids.** Collections are NAMED. An id is a hash of the schema's own shape, so it would
  couple both sides to identical schema definitions; a name lets the receiver resolve its own.

## Parameters

### changes

[`BulkPersistChanges`](../classes/BulkPersistChanges.md)

### schemas

[`ReadonlySchemaCollection`](../classes/ReadonlySchemaCollection.md)

## Returns

[`SerializedPersistRequest`](../type-aliases/SerializedPersistRequest.md)
