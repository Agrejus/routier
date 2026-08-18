---
title: Create Your Own Plugin
---

# Build a Storage Plugin

Implement `IDbPlugin` from `@routier/core/plugins` when Routier needs to target a backend that does not already have a storage plugin. Application users selecting a built-in backend do not need this SPI.

## Requirements

A plugin must implement a small interface that Routier uses during reads/writes:

- initialize/destroy lifecycle
- add/update/remove batched entity operations
- query execution with parameterized filters, ordering, skip/take
- change tracking integration (apply computed/tracked fields after save)
- identity/index awareness (keys, distinct, composite indexes)

## Minimal skeleton

<<< @/_snippets/code/integrations/plugins/create-your-own/minimal-plugin.ts

## Key behaviors

- Respect schema metadata passed by collections (keys, indexes, nullable/optional/defaults).
- Compute fields marked as `computed()` after persistence; persist when `tracked()`.
- For `identity()` columns, return generated values so entities can be updated in memory before `saveChangesAsync()` resolves.
- For `distinct()`/`index()` ensure unique or indexed storage if supported by the backend.
- Push what each query executed into `event.executedQueries` after it runs — `{ text, parameters? }`, once per backend read. This is how your plugin supports [`.explain()`](/concepts/queries/explain). A plugin that does not push still works; explanations then mark its step as not reported.

### Separation for single-collection datastores

If your datastore persists all entities into one physical table/collection (e.g. PouchDB), add a tracked computed property to each schema that records its collection name. This guarantees clear separation between entity types and prevents cross‑collection collisions when fields share names (like `name`). See the tracked + computed example in the schema modifiers reference: [Tracked computed](/concepts/schema/modifiers/schema-modifiers#tracked-computed). With SQL/SQLite backends, this is not an issue since data is already isolated per table.

## Testing your plugin

- Start with the Memory plugin behavior as a reference.
- Use the CRUD how‑to pages to validate operations and saved changes.
- Wire into an example app and run live queries to ensure incremental updates behave as expected.

## Examples to study

- Built‑in implementations:
  - [Memory](/integrations/plugins/built-in-plugins/memory/README)
  - [Dexie](/integrations/plugins/built-in-plugins/dexie/README)
  - [PouchDB](/integrations/plugins/built-in-plugins/pouchdb/README)
  - [File System](/integrations/plugins/built-in-plugins/file-system/README)
  - [SQLite](/integrations/plugins/built-in-plugins/sqlite/README)

## Next steps

- [Query Translation for Plugin Authors](/integrations/plugins/advanced-plugins/query-translation/) — push filters, joins, sorting, and aggregation into the backend.
- [Result Translation for Plugin Authors](/integrations/plugins/advanced-plugins/result-translation/) — adapt backend rows and finish operations in memory.
- Expose configuration through the constructor and document the backend's durability, concurrency, migration, and failure guarantees.
