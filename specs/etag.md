# ETags on the schema

Status: **Built** on `feature/schema-etag`. Every plugin supports etags.

- Built: the builder, compiled schema, comparators and serialization; etag generation in every
  plugin; the `etags: 'keep'` write mode and `etagOwner`; `HttpSwrDbPlugin` revalidation by row
  etag and by `If-None-Match` (#63); `pouchRevision`; `ConcurrencyDbPlugin` guarding by a
  declared etag.

## The idea

A schema can mark one `number` or `string` property as the row's ETag:

```ts
import { s, etags } from '@routier/core/schema';

const itemSchema = s.define('items', {
    id: s.string().key().identity(),
    name: s.string(),
    version: s.number().etag(etags.numeric),
}).compile();
```

The ETag works like `.identity()`: routier declares it, the backing datastore generates it.
The difference is that the datastore sets the ETag on insert **and replaces it on every
update**. Application code never writes it.

## Decisions

1. **The datastore generates every value.** Routier only describes the ETag: which property,
   its type, and how to order two values. How a new value is produced (`version + 1`,
   `now()`, a server-assigned string) belongs to the plugin, the same as identity values
   today.
2. **`.etag()` takes a comparator** that says which of two ETags is newer:

   ```ts
   type EtagComparator<T extends number | string> = (prev: T, next: T) => number;
   ```

   It returns a negative number, `0`, or a positive number, with the same meaning as an
   `Array.prototype.sort` comparator: negative when `next` is newer, positive when `prev` is
   newer, `0` when they are the same. Sorting with it puts the oldest first. Routier ships prebuilt comparators in `etags`; a
   developer can pass their own.
3. **Optional and nullable are the developer's choice.** `.etag().optional()` and
   `.etag().nullable()` are both allowed and change the inferred type the same way they do on
   any other property. They carry no extra ETag meaning.
4. **Using the ETag is each plugin's concern.** Every plugin reads the ETag from the
   compiled schema and must support it: generate and update it in storage, and decide what
   to do with it (for example, conflict detection or revalidation). Core does not impose a
   behavior, and core does not tell a plugin how to generate a value.
5. **At most one ETag per schema, at the root.** Compiling a schema with two `.etag()`
   properties throws, and so does an `.etag()` nested inside `s.object()`, the same way a nested
   `.searchable()` does: a nested ETag type-checks but no plugin could find it.
6. **Invalid combinations are impossible, not refused.** The builder simply does not expose
   them, so they do not type-check. There is no runtime check for them.

## Schema builder

- `.etag(comparator)` exists on `SchemaNumber` and `SchemaString` only.
- It returns a new `SchemaEtag` modifier, following `SchemaIdentity`: it sets `isEtag = true`,
  stores the comparator, and adds `"etag" | "readonly"` to the modifiers so the inferred
  entity type makes the property readonly.
- Unlike `SchemaIdentity`, which exposes no further methods, `SchemaEtag` exposes
  `.optional()` and `.nullable()`, and nothing else.
- `.key()`, `.identity()`, `.default()` and `.from()` are not reachable after `.etag()`, and
  `.etag()` is not reachable after them (decision 6). The optional and nullable modifier
  classes that follow `.etag()` must not expose them either.

## Compiled schema

Plugins read the ETag the same way they read identity today:

- `PropertyInfo` gains `readonly isEtag: boolean` and
  `readonly etagComparator: EtagComparator | null`, copied from the builder like `isIdentity`.
- `CompiledSchema` gains `etagProperty: PropertyInfo<TEntity> | null`, so a plugin does not
  have to scan the property list.
- Compilation rejects a second ETag property and a nested one (decision 5), in
  `core/src/schema/utils/etagProperty.ts`.
- The inferred entity type makes the ETag readonly, and keeps `.optional()` and `.nullable()`
  on it. The create type leaves it out, as it does an identity. Checked under `strict` in
  `core/type-tests/etag.ts`.

## Prebuilt comparators

Core ships two, in `etags` from `@routier/core/schema`:

| Name | Type | Newer means |
|---|---|---|
| `etags.numeric` | `number` | larger number (counters, epoch milliseconds) |
| `etags.lexical` | `string` | later in code-unit order, for sortable IDs such as ULID or UUIDv7 |

`@routier/pouchdb-plugin` ships `pouchRevision` for PouchDB's `_rev` (`"<generation>-<hash>"`).
It compares the generation numerically, then the hash in code-unit order, which is how
PouchDB and CouchDB pick the winning revision. It lives in the plugin because core may not
name a storage engine (`specs/core-agnosticism.md`).

```ts
import { pouchRevision } from '@routier/pouchdb-plugin';

const noteSchema = s.define('notes', {
    _id: s.string().key().identity(),
    _rev: s.string().etag(pouchRevision),
    body: s.string(),
}).compile();
```

The PouchDB plugin already fills `_rev` on updates and removes and writes back the new
revision after a save (`plugins/pouchdb/src/PouchDbPlugin.ts:175`, `:306`). With an ETag
declared, it writes the revision to the ETag property.

## Serializing the comparator

The comparator travels with the schema the same way `.computed()` functions do, through
`core/src/schema/utils/standardJsonSchema.ts`:

- **Export:** `comparator.toString()` is stored in the property's `x-routier` metadata, beside
  `isEtag: true`, as `computed` stores `functionSource` (`:289`).
- **Import:** the source is rebuilt with `new Function` and its `toString` returns the
  original source, so a second export writes the same text (`:690`–`:720`).

That puts rules on every comparator, prebuilt or custom:

- It is an arrow function with parenthesized parameters, `(prev, next) => ...`. The import
  parser (`compileArrowFunction` in `core/src/schema/utils/functionSource.ts`, shared with
  `computed`) matches `^\(([^)]*)\)\s*=>`, so `prev => ...` and `function` declarations do not
  round-trip.
- It is self-contained: no helper calls, imports or captured variables. A comparator that
  calls a helper exports fine and then fails after import, because the helper does not exist
  inside `new Function`. `pouchRevision` therefore splits and compares `_rev` inline.
- The prebuilt comparators have a round-trip test: export, import, and compare the same pairs
  before and after.

Import failures follow the `computed` path: an unparseable source becomes a function that
throws naming the property. Unlike `computed`, it keeps the original source as its
`toString`, so exporting again does not lose it.

Mutation testing cannot instrument `core/src/schema/etags.ts` and run the round-trip tests at
once: Stryker's inserted calls become part of the comparator's source text, which then does
not rebuild. Mutate `etags.ts` with `etag.test.ts` alone, and the serialization code with the
round-trip tests.

## Keeping etags

A persist event may carry `etags: 'keep'` (the default is `'generate'`). A store told to keep
stores the etag each row carries instead of generating one. Every plugin that generates etags
honors it. It is set wherever another store owns the etags:

- `HttpSwrDbPlugin`, on every write to its local cache: the server owns the etags.
- `PluginSyncEngine`, on every mirror write, when the source owns them (`etagOwner: 'source'`,
  the default).
- `PluginSyncEngine` with `etagOwner: 'mirrors'`: the source write keeps, and each mirror gets
  every row with its etag removed and generates a new one. `OptimisticUpdatesDbPlugin` uses
  this: its memory copy is the engine's source, but the durable store owns the etags. A PouchDB
  mirror then resolves the current `_rev` itself; a `_rev` from the memory copy would be stale
  or foreign, and PouchDB would reject the write.
- `OptimisticUpdatesDbPlugin`, when it hydrates its memory copy from the source.

`BatchingDbPlugin` never merges writes with different modes. The shared contract suite
`describeEtagContract` in `@routier/test-utils` covers generation and both modes; every plugin
that supports etags runs it.

## Plugins

Every plugin changes to support ETags. It reads `schema.etagProperty` and, when present,
generates the value on insert and replaces it on every update, in whatever way suits its
storage. Order:

1. `memory`, `dexie`, and `replication` (`HttpSwrDbPlugin`, which unblocks #63)
2. The SQL plugins: `sql-core`, `sqlite`, `postgres-core`, `postgresql`, `pglite`, `mysql`
3. The rest: `browser-storage`, `file-system`, `mongodb`, `pouchdb`, and the wrapping plugins
   (`encryption`, `otel`, `blob`) where they need to pass the ETag through

PouchDB creates and updates `_rev` itself, so the plugin needs no etag code: a schema declares
`_rev: s.string().etag(pouchRevision)`. The contract suites in `@routier/test-utils` keep
`_rev: s.string().identity()`, because `test-utils` cannot import `pouchRevision` (the PouchDB
plugin depends on `test-utils`), and those suites do not exercise revisions.

### SQL

`sql-core` owns the update builders every SQL plugin uses, so etags live there
(`sql-core/src/etags.ts`). The builders drop the etag column from whatever the delta or
whole-entity fallback supplies, then:

- generate, number etag: `SET "version" = COALESCE("version", 0) + 1`, atomic, with no read
  first; the new value reaches the entity through the read-back each plugin already does
  (`RETURNING`, or MySQL's select after the write)
- generate, string etag: a fresh token as a parameter
- keep: the value the row carries, as a parameter

Inserts get their etag in JS before the `INSERT`.

### MongoDB

MongoDB echoes the entities it wrote rather than reading them back, so the plugin reads the
stored etags of the updated documents inside the save's transaction, generates the next value
in JS, and adds it to the `$set`. An update with an empty delta now writes the whole entity,
which is core's convention; it used to write nothing.

### Concurrency

`ConcurrencyDbPlugin` uses the declared etag when the schema has one: each update carries
`concurrency: { column: <etag>, expected: <the etag the entity holds> }`, the store generates the
next etag as usual, and a stale write matches no row and fails with
`OptimisticConcurrencyError`. No hidden `__version` column is added and no versions are tracked.
Schemas without an etag keep the hidden column. Dexie and D1 do not detect conflicts, as before.
