# Domains — who is responsible for what

Date: 2026-08-07
Status: **Enforced.** `npx jest -c jest.config.js --selectProjects architecture`

## Where it lives

`architecture/src/domains.ts` is the single source of truth. This file is a pointer, not a
copy — a second copy would drift, and a stale charter is worse than none because it is
believed.

Two things read the manifest:

| | |
| --- | --- |
| `architecture/src/writeDomainDocs.ts` | Renders a `DOMAIN.md` into each domain directory, so a file's charter sits next to the file |
| `architecture/src/domains.test.ts` | Fails when the repository stops matching it |

A `DOMAIN.md` is generated. Edit the manifest and run `npm run domains:write -w @routier/architecture`.

## The shape of the system

```
caller
  ↓
datastore          CRUD abstraction. Agnostic, in its own way.
  ↓                Speaks: schemas, collections, expressions, change sets.
IDbPlugin          Frozen at query / destroy / bulkPersist.
  ↓
plugin             Translates that way into a query language.
  ↓                SQL via sql-core · MQL via mongodb-plugin · a JS predicate via JsonTranslator
database
  ↓
translator         Converts the response back into something the datastore recognizes.
```

The load-bearing sentence: **the datastore never speaks a query language, and a plugin is the
only thing that does.** Everything else follows from it.

## What each domain owns

| Domain | Responsible for |
| --- | --- |
| `core` | The data model. No storage, no engine name, no statement. |
| `core/src/expressions` | The agnostic query language the datastore speaks. |
| `core/src/schema` | What an entity is. `PropertyInfo` is a property and its metadata; `.modify()` changes a schema. |
| `core/src/collections` | Defining a collection, and the pending changes against one. |
| `core/src/plugins` | The contract. `IDbPlugin` is frozen and will not grow. |
| `core/src/plugins/translators` | Database response → something the datastore recognizes. |
| `datastore` | The CRUD abstraction that routes everything to plugins. |
| `plugins` | Where data lives, and translation into a query language. |
| `plugins/sql-core` | The SQL knowledge every SQL plugin shares. |

## What the test actually checks

1. **Orphans.** A package with no entry fails. That failure is the prompt to say what the code
   is for, while the person who knows still has it in hand.
2. **Docs.** Each `DOMAIN.md` matches what the manifest renders.
3. **Vocabulary.** An agnostic domain names no engine. Matched against **code, not prose** —
   comments are stripped, because explaining why a concept is absent is worth keeping and a
   rule that punished it would train people to delete the explanation instead of the
   dependency.
4. **Dependency direction.** `core` imports no workspace package. `datastore` imports only
   `core`. A package referring to itself is not a violation.
5. **`IDbPlugin` is frozen** at `databaseName`, `query`, `destroy`, `bulkPersist`. A fourth
   method fails the suite. A feature that seems to need one is either a wrapper plugin or a
   translator. `databaseName` is not an operation — it is what the plugin IS, the identifier
   for the database it talks to, and the rule is that the interface grows no new BEHAVIOUR.
   See `specs/plugin-database-name.md`.

## What it caught on the first run

- `datastore/src/data-access/DataBridge.ts` imported `@routier/memory-plugin` — the CRUD
  abstraction depending on one specific backend. Nothing about the need was plugin-shaped:
  `EphemeralDataPlugin` and `MemoryDataCollection` are both in core, so the datastore now
  builds its own scratch store. See `datastore/src/data-access/ChangeMatchProbe.ts`.
- A `ChangeTracker` diagnostic asserted what SQLite does with booleans. Reworded to describe
  the class of backend rather than name one.

## See also

- `specs/core-agnosticism.md` — the rule this generalizes, and the violations that predated it
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the schema-augmentation technique a wrapper uses
- `plugins/sql-core/src/sql.ts` and `plugins/mongodb/src/mql.ts` — two translations of one
  expression tree
