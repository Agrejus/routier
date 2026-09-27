---
title: Migrating Stored Data
doc_role: guide
description: Change a Routier schema without breaking the rows your users already have stored.
---

# Migrating Stored Data

A browser database outlives the build that created it. When you change a schema, rows written by the previous release are still on the device, in the old shape, and nothing rewrites them for you.

Routier does not ship a migration runner. You don't need one: the schemas you already define are enough to find old rows and rewrite them. This guide explains what Routier does with an old row and gives two recipes, one for backfilling new fields and one for reshaping data using the before and after schemas.

## Quick navigation

- [How old rows behave](#how-old-rows-behave)
- [Pick a strategy](#pick-a-strategy)
- [Backfill a new field](#backfill-a-new-field)
- [Reshape with before and after schemas](#reshape-with-before-and-after-schemas)
- [Snapshot each schema version](#snapshot-each-schema-version)
- [When to run a migration](#when-to-run-a-migration)
- [Storage-specific steps](#storage-specific-steps)
- [Local-first apps](#local-first-apps)
- [Testing a migration](#testing-a-migration)

## How old rows behave

Suppose version 1 stored `{ id, title, done }` and version 2 replaces `done` with `status` and adds `schemaVersion`, both with defaults. Here's what the version 2 app sees when it opens the version 1 database:

| Operation | What happens to an old row |
| --- | --- |
| Read a whole entity (`toArrayAsync`, `firstAsync`, ...) | Missing fields are filled from their defaults. Fields no longer in the schema are dropped. The row *looks* current. |
| Query on a field (`where`, `sort`, `map`, `count` with a filter, index lookups) | Runs against what is actually stored. The new field is absent, so `where(t => t.status === "open")` does not match the old row and `map(t => t.status)` returns `null`. |
| Save an entity that changed | The whole entity is written in the current shape: defaults are stored and removed fields disappear from storage. |
| Save an entity that did not change | Nothing is written. Assigning a value equal to the read-time default is not a change. |

Two rules follow from this:

1. **Defaults cover display, not queries.** If you only display a new field, you can skip the migration. If you filter, sort, index, or sync on it, the stored rows need the value too.
2. **Removed fields are lost on the next write.** Read anything you need from an old field *before* a current-schema write drops it.

## Pick a strategy

| Change | What to do |
| --- | --- |
| Add a field with a default, only displayed | Nothing. Reads fill the default. |
| Add a field you query, sort, or index on | [Backfill](#backfill-a-new-field) so the stored rows carry the value. |
| Remove a field | Nothing. Rows shed it the next time they are written. |
| Rename, split, merge, or change a field's type or meaning | [Reshape with before and after schemas](#reshape-with-before-and-after-schemas). |
| Add a collection or an index | A structural change. See [storage-specific steps](#storage-specific-steps). |

## Backfill a new field

The product schema gains an indexed `category` with a default. Old rows have no stored category, so an index lookup on `"general"` misses them. `where(p => p.category == null)` runs against storage and finds exactly those rows. Reading them fills in the default, and `markDirty` forces a write even though no property was assigned:

<<< @/_snippets/code/from-docs/guides/schema-migrations/backfill.ts

The migration identifies its own work: once a row has a stored category, it no longer matches the filter. Running it twice is safe, and the second run returns `0`.

## Reshape with before and after schemas

A reshape needs values the current schema no longer describes. `done` is gone from `todoV2`, and a `todoV2` read drops it. Keep the old schema in your code as `todoV1`, and use a small store built on it to read the values you need.

This recipe gives you:

- **Typed transforms.** `upgradeTodo` takes `InferType<typeof todoV1>` and returns part of `InferType<typeof todoV2>`, so the compiler checks both sides.
- **A version marker.** `schemaVersion` defaults to the current version, so every new row is stamped when it's created. Old rows have no stored value, so `schemaVersion == null` finds them, and `schemaVersion < current` finds rows from any later migration you add.
- **Resumable, repeatable runs.** Only unmigrated rows match, so a run that was interrupted picks up where it left off, and a finished one does nothing.

<<< @/_snippets/code/from-docs/guides/schema-migrations/reshape.ts

Details that matter:

- **Pass the version as a parameter.** Query expressions are parsed, not run as closures. Write `where(([t, p]) => t.schemaVersion < p.current, { current: SCHEMA_VERSION })`, not `where(t => t.schemaVersion < SCHEMA_VERSION)`. A closed-over variable can't be parsed.
- **Read legacy values before writing.** `readLegacyTodos` finishes before `saveChangesAsync` writes the new shape, which drops `done` from storage.
- **Both stores open the same database** with the same `DexiePlugin` version, so the legacy store never tries to downgrade it.
- **Always `markDirty`.** Some upgraded rows end up equal to what the read-time defaults already showed (here, `done: false` becomes `status: "open"`). Change tracking sees no change, so without `markDirty` those rows would never be written.

### Chaining versions

Each migration only changes the fields its version introduced. For a later change, add `todoV3`, set the marker to 3, and add an `upgradeTodoV2toV3` step. A row still at version 1 runs both steps in order. Keep old schema definitions in their own modules (`schemas/todo.v1.ts`). Once every device you support has migrated past a version, delete that module and its step.

## Snapshot each schema version

Every schema definition can export itself as JSON Schema, with Routier's metadata under `x-routier`. Committing that output for each release gives you a record of the shape every version wrote. A pull request that changes a schema then shows the change as a readable diff, such as "`done` removed, `status` added", right next to the migration that handles it.

The export lives on the definition, so keep the definition before you compile it:

<<< @/_snippets/code/from-docs/guides/schema-migrations/snapshot.ts

Run it as part of your release or build step and commit `schema-snapshots/`.

A snapshot records structure, not code:

| Kept | Not kept |
| --- | --- |
| Field names, types, optional and nullable flags | Literal unions: `s.string("open", "done")` comes back as `string` |
| Keys, identities, indexes, distinct | Function defaults such as `default(() => new Date())`, which are only flagged |
| Literal defaults such as `default("open")` | Computed properties, transforms, custom serializers |
| Collection name and id properties | |

`SchemaDefinition.fromJson(json)` turns a snapshot back into a compiled schema at runtime (see the [Schema API](/concepts/schema/schema-api)). A rehydrated schema can open a store and read old rows, but its type is only known at runtime, so the compiler can't check an upgrade function against it. If you want typed upgrades, keep the old definition in code as the recipe above does, and treat snapshots as documentation.

How you combine these is up to you: snapshots only, old definitions only, or both.

## When to run a migration

Run migrations once at startup, after the store is created and before the UI queries it. Queries that run before the migration can miss old rows, as shown in [How old rows behave](#how-old-rows-behave).

- Await the migration before rendering screens that filter on the migrated fields.
- A browser can have several tabs of the app open at once. Because the migration only touches unmigrated rows, it is safe for two tabs to run it: the second finds nothing, or rewrites a row with the same values.
- For large collections, process `pending` in pages with `take` and save after each page. The version filter lets each page resume where the last one stopped.

## Storage-specific steps

Routier handles the rows. Structural changes still belong to the storage engine.

| Plugin | Structural change |
| --- | --- |
| Memory, localStorage/sessionStorage | None. There is no layout to change. |
| Dexie (IndexedDB) | Raise `version` in `new DexiePlugin(name, { version })` whenever you add a collection or an index. See the [Dexie plugin](/integrations/plugins/built-in-plugins/dexie/README) notes. Every store that opens the database, including a legacy one, uses the new version. |
| SQLite, PGlite, PostgreSQL, MySQL | The plugins create missing tables and never alter existing ones. Add, rename, or drop columns with your own DDL or migration tool *before* the new build writes. Then use the recipes above for the data itself. |

## Local-first apps

- **Migrate the local store, not the sync layer.** If your store wraps its local plugin in `HttpSwrDbPlugin`, a migration saved through that store is an ordinary write and gets queued for sync to the server. Run the migration through a store built directly on the local plugin, unless you want the server to receive every rewritten row.
- **Don't clear unsynced work.** Deleting the database and re-downloading it loses changes that haven't reached the server. Migrate the local rows in place instead.
- **Coordinate with the server.** The server must accept writes in the new shape from migrated clients and in the old shape from clients that haven't updated yet. If it starts sending the new shape first, the old client's reads fill defaults and drop the unknown fields in the same way.

See [Local-First Apps](/guides/local-first-apps) for the rest of the sync lifecycle.

## Testing a migration

Test against real old-shape rows, not hand-built objects:

1. Open a store on the **before** schema, add rows, and save. This is the database a user has after the previous release.
2. Open the current store and run the migration.
3. Assert on queries against the migrated field, such as `where(t => t.status === "done")`, not only on whole-entity reads. Whole-entity reads show defaults even when nothing was migrated.
4. Run the migration again and assert that it reports `0`.

`fake-indexeddb` runs Dexie-backed stores under Node, and `MemoryPlugin` instances that share a database name share their data, so both steps can use in-process stores.

## Related

- [Attachments & Dirty Tracking](/guides/attachments): `markDirty` and the tracked set
- [Schema modifiers](/concepts/schema/modifiers/README): `default`, `index`, and friends
- [Built-in plugins](/integrations/plugins/built-in-plugins/): per-backend constraints
