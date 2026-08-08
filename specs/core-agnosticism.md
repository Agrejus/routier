# Keeping `@routier/core` storage-agnostic

Status: **Enforced as of 2026-08-02.** `core/src` contains no engine name and no storage-shaped contract.
Date: 2026-08-02

## The rule

`@routier/core` may describe **the data model**: schemas, properties, expressions, change
sets, results. It may not describe **storage**: no column, no SQL, no dialect, no driver
quirk, and no type named after an engine.

Plugins translate the model into storage. That is the entire reason they exist.

## Why this needs writing down

Nobody decided to put PostgreSQL in core. It arrived one bug fix at a time.

The Postgres fix in `known-defects.md` #4 needed `COUNT(*)` coerced from a bigint string, and
the natural place to put it looked like `SqlTranslator.count` — which lived in core. Two
lines, obviously correct, shipped. That is how every one of the violations below got in.

So the useful question during a fix is not "is this the smallest change" but **"is this a
fact about the data model, or a fact about a database?"**

## What was moved, and where it went

| Was in core | Problem | Now |
| --- | --- | --- |
| `expressions/sql.ts` | `SqlDialectName = "sqlite" \| "postgresql" \| "mysql" \| "mssql"` plus each engine's quoting, placeholders, LIKE/GLOB and escape rules. Also carried an `mssql` dialect for an engine with no plugin. | `@routier/sql-plugin-core` (`plugins/sql-core`) |
| `SqlTranslator.count`'s bigint branch | A `node-postgres` behaviour. | `plugins/postgresql/src/PostgresSqlTranslator.ts`, as an override |
| `EntityUpdateInfo.delta: { [key: string]: string \| number \| Date }` | A SQL `SET column = ?` list, and under-typed even for that — booleans, nulls, arrays and objects are all legal schema types it excluded. | `EntityDelta<T>` — a partial entity |

`SqlTranslator` itself **stays in core** deliberately. It encodes that *aggregate results
arrive as rows*, which is a shape convention rather than engine knowledge, and it names no
engine. A driver that deviates overrides it in its own plugin.

## The delta, before and after

Core now says what changed in the model's own terms:

```ts
{ nested: { inner: { value: "y" } } }     // a partial entity
```

Not a column list, and not the dotted-path map it used to build
(`{"nested.inner.value": "y"}`) — which was defect #13, a shape *no* consumer could use:
not a column name, not a document path.

Translation is the plugin's job:

```
core             EntityDelta — "these properties changed"
                    ↓
sql-plugin-core  toColumnAssignments(delta, schema, dialect)
                 → resolves renames to storage names
                 → JSON-encodes nested objects and arrays
                    ↓
sqlite / postgres / mysql   own dialect, own JSON column type

memory / file-system   ignore the delta, apply the whole entity
pouchdb                the partial IS a document patch — no translation
```

### The subtlety that bites

`toColumnAssignments` decides to JSON-encode on the value's **runtime shape**, not on the
property's declared type. A delta has already been through `schema.serialize`, so a property
carrying `.serialize(x => JSON.stringify(x))` arrives as a string that is *already* JSON.
Encoding by declared type double-encodes: `"[]"` becomes `"\"[]\""`, and the read side
deserializes that to the string `"[]"` instead of an array — which surfaces a long way away
as `Cannot create proxy with a non-object as target`. That is a real failure this refactor
hit and the tests now pin.

Consequence worth knowing: schemas that already encode their own JSON keep working
untouched, and schemas that do not now get JSON storage for free.

Each engine's JSON column type is stated **once**, on its dialect (`jsonColumnType`), and
both the DDL and `toColumnAssignments` read it from there so they cannot drift.

## How to check

**Superseded by a test as of 2026-08-07.** This rule is now one entry in
`architecture/src/domains.ts`, enforced by `architecture/src/domains.test.ts`:

```bash
npx jest -c jest.config.js --selectProjects architecture
```

The grep below is what it replaced. Every violation in the table above got in because it was
a grep somebody had to remember to run, and each fix was two lines and obviously correct on
its own.

```bash
# The old check. Must print nothing.
grep -rniE "sqlite|postgres|mysql|mssql|pouchdb|dexie|indexeddb" core/src --include="*.ts" \
  | grep -v "\.test\.ts"
```

Two differences worth knowing:

- The test matches **code, not prose**. Comments are stripped first, because explaining why a
  concept is absent is exactly the commentary worth keeping — a rule that punished it would
  train people to delete the explanation rather than the dependency. A type or an import
  named after an engine still fails.
- It covers **every domain**, not just core, and adds dependency direction. That is what
  caught `DataBridge` importing `@routier/memory-plugin`: the CRUD abstraction depending on
  one specific backend. See `datastore/src/data-access/ChangeMatchProbe.ts` for the
  replacement, built from `EphemeralDataPlugin` and `MemoryDataCollection` in core.

The permitted hits are declared as `allowedIn` on the rule, so an exception has to be written
down with a reason rather than remembered.

## Still open

- **`InferType` is a work in progress**, so `EntityDelta<T>` inherits whatever it gets wrong
  about nullable/optional/renamed properties. The runtime shape is right; the type may need
  hardening.
- **Read-path decoding is unchanged.** Writing a nested value as JSON works; reading it back
  still depends on the schema's `.deserialize()`. A schema with no serializer on a nested
  property will now write JSON it cannot itself parse on the way back. Worth an
  `E2E_CONTAINERS=1` round-trip test before relying on it.
- `plugins/sql-core` has no bundler config yet (types only, no `rspack`), so it is
  test-and-source ready but not built for publish.
