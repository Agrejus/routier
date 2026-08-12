# Naming the database a plugin talks to

Date: 2026-08-10. **Built.** Replaces `IDbPlugin.identity` with a required `databaseName`.

## What `identity` is doing today

It is a **subscription channel scope key**, and nothing else.

`SchemaSubscription` is backed by `BroadcastChannel`, and channels live in a process-wide
registry keyed by `core/src/schema/communication/broadcast.ts:20`:

```ts
const getChannelKey = (schemaId, scope) => scope == null ? String(schemaId) : `${schemaId}|${scope}`;
```

`scope` is the plugin's `identity`, and it arrives from exactly three call sites:
`DataStore.ts:95` (collections), `DataStore.ts:145` (views), and `DataBridge.ts:31`. The purpose
is to keep two DIFFERENT databases holding the same schema from seeing each other's change
notifications, while two instances of the SAME database — another browser tab, a worker — stay
connected.

It has nothing to do with `s.string().key().identity()`, which marks a column the database
assigns. That collision is reason enough to rename it, and it is not the main reason.

## Why it changes

### It is optional, and the absent case fails toward cross-talk

`scope == null` falls back to the schema id ALONE, which means every store holding that schema
shares one channel regardless of which database it points at. That is precisely the situation the
mechanism exists to prevent, and it is the default.

### The engines most likely to hit that never implement it

Only `MongoDbPlugin` (`identity ?? driver.name`) and `EphemeralDataPlugin` (its `databaseName`)
declare one; `BlobDbPlugin`, `ConcurrencyDbPlugin` and `RetryDbPlugin` forward. **SQLite,
PostgreSQL, MySQL, Dexie and PouchDB declare nothing**, so every one of them runs on the
schema-only key today. Two stores over two different Postgres databases with the same schema
currently share a channel and notify each other about rows the other never wrote.

### Optional cannot be made safe by a wrapper

A wrapper that forgets to forward an optional member compiles, returns `undefined`, and silently
drops the whole stack back to the shared key. There is no version of optional where that is a
build error.

## The change

```ts
export interface IDbPlugin {
    /**
     * Uniquely identifies the database this plugin talks to — INCLUDING host or path where a
     * bare name would collide. Two plugin instances over the same database must return the
     * same string, in this process and in any other; two over different databases must not.
     *
     * Used to scope schema subscription channels, so instances of one database (another tab,
     * a worker) see each other's changes and unrelated databases do not.
     */
    readonly databaseName: string;

    query(...): void;
    destroy(...): void;
    bulkPersist(...): void;
}
```

Required, not optional. Every failure mode above closes by construction: there is no absent case,
so the schema-only key is unreachable, and a wrapper that forgets to forward fails to compile.

Note what this does NOT cost: cross-tab liveness keeps working exactly as it does now, and starts
working for the five engines that never had it. There is no opt-in migration for existing users
of the browser plugins.

### The plugin owns it because only the plugin knows it

A unique identifier for a Postgres database is host + port + database; for SQLite it is the
resolved file path. An application author asked to supply a string guesses at that and tends to
supply the short version — `"orders"`, `"mydb"` — which collides across hosts and directories.
`PostgresDbPlugin` can build the full value from the config it already holds. Placing the name on
`DataStore` instead was considered and lost on exactly this point.

### Derived, never generated

A random name per `DataStore` was considered and rejected. It is unique per PROCESS, not per
DATABASE — and the channel exists to connect contexts that never shared memory. A second tab
regenerates the name, never matches, and cross-tab liveness dies. A generated name can only ever
isolate; it can never connect.

The corollary is that **"instantiate the plugin once and share it everywhere" stays guidance, not
a correctness requirement**. It is worth doing for connection reuse, and a shared instance is
required by anything that batches or pools — but it cannot be what makes channel scoping correct,
because no amount of instance sharing reaches across a process boundary. Deriving the name from
the database's coordinates works whether the instance is shared or not.

### What each plugin returns

| Plugin | Value |
| --- | --- |
| `SqliteDbPluginBase` | already holds `protected readonly databaseName` — widen to public |
| `D1DbPlugin` | the binding's database name |
| `PostgresDbPlugin` | `postgres://{host}:{port}/{database}` from its config |
| `MysqlDbPlugin` | same shape, from its config |
| `MongoDbPlugin` | already has it as `identity ?? driver.name` — rename |
| `EphemeralDataPlugin` | already holds `databaseName` — widen to public |
| `MemoryPlugin`, `BrowserStoragePlugin`, `FileSystemPlugin` | inherited; file-system must include its `path` |
| `DexiePlugin` | its `dbName` |
| `PouchDbPlugin` | its `name` constructor argument |
| `HttpDbPlugin`, `HttpSwrDbPlugin` | the endpoint URL |
| wrappers — `Concurrency`, `Retry`, `Cache`, `Blob`, `OptimisticUpdates`, `PluginSyncEngine` | delegate to the inner plugin |

A connection string carrying a password must not be returned verbatim: the value appears in a
channel key, so build it from host/port/database and leave credentials out.

### Three plugins cannot derive a name, and say so

`D1DbPlugin` and the HTTP plugins have nothing to derive from — a D1 binding carries no readable
name, and `HttpPluginOptions.getUrl` is a caller-supplied function of collection name, so there
is no origin to read without inventing a collection to ask about. Both take an optional
`databaseName` and fall back to a shared constant (`"d1"`, `"http"`), documented as needing to be
set whenever one process talks to two of them over the same schema. That is a weaker guarantee
than the other plugins give, and it is stated at the option rather than left to be discovered.

`SqliteDbPluginBase` returns the path as the caller spelled it. Resolving it needs a file system
and the plugin also runs in the browser, so a relative and an absolute spelling of one file read
as two databases. `FileSystemPlugin` has no such constraint and does resolve, reusing the same
value as its collection registry key.

## Work

1. `core/src/plugins/types.ts` — `identity?: string` becomes `readonly databaseName: string`.
2. The engine plugins in the table, each gaining a getter. Five have nothing today.
3. The six wrappers, each delegating.
4. Rename at the three call sites — `DataStore.ts:95`, `DataStore.ts:145`, `DataBridge.ts:31`.
   The broadcast layer keeps taking an opaque `scope`; only the argument's source is renamed.
5. ~~`getChannelKey` drops its `scope == null` branch, which is now unreachable.~~ **It is not
   unreachable, and the branch stayed.** `CompiledSchema.createSubscription(signal?, scope?)` is
   public and callers do use it with neither argument — `HttpSwrDbPlugin` did, and so do two
   tests and a documented example. The unscoped key now means "a channel per schema across the
   process", which is what asking for no scope means; every datastore path supplies a name, so
   the fallback can no longer be arrived at by accident.

   This mattered more than it looks. A SENDER that omits the scope no longer reaches datastore
   listeners, because they moved to `schema|databaseName`. `HttpSwrDbPlugin` broadcast its
   revalidation results that way, so giving the plugin a name would have silently stopped
   delivering them — the plugin sending into a channel nobody was on. Two tests failed on
   exactly that and are fixed by scoping their senders, which is how it was caught.
6. `specs/domains.md:65` and `architecture/src/domains.test.ts:283` — the frozen set becomes
   `databaseName, query, destroy, bulkPersist`.
7. `specs/write-batching.md` — stop citing `identity?` as precedent for putting `composition` on
   `IDbPlugin`. It is not one any more, and that question reopens on its own terms.

### The breaking surface

This is a breaking change to `IDbPlugin`, so every implementation must add the member — including
any a user wrote. In this repo that is the plugins above plus roughly seven test doubles
(`CountingPlugin`, `FlakyPlugin`, `CloneOnReadPlugin`, `RoutingProbePlugin`,
`QueryRoutingProbePlugin`, `CountingDbPlugin`, `LaggingPlugin`), the stress harness, and three
documented examples under `docs/_includes/code/` and `examples/`. Test doubles can return a
constant; they are one database each.

## Tests

Built as `datastore/src/collections/databaseScoping.test.ts` — the cross-talk pair and the
wrapper forwarding. The derivation and credential tests below are **not** built: they belong
beside the Postgres and MySQL plugins and are worth adding when those suites are next touched.


- **Two databases do not cross-talk.** Two plugin instances with different `databaseName`, one
  schema, a subscriber on each. A save through one must not notify the other. This is the
  regression that exists today for every SQL engine and nothing catches it.
- **One database does connect.** Two plugin instances with the SAME `databaseName` — the two-tab
  case, modelled in-process — must see each other's notifications. The obvious over-correction is
  to key by instance, which passes the first test and fails this one.
- **Wrappers preserve the name.** Each wrapper over a plugin with a known name reports that name.
  A wrapper that dropped it would silently rejoin the shared key, and the type system only
  catches the case where it is missing entirely, not where it returns something of its own.
- **The name is stable across instances.** Two `PostgresDbPlugin`s built from equal config return
  equal names; two over different hosts do not. The derivation is the whole contract, and it is
  the part a plugin author gets wrong by returning a bare database name.
- **No credentials in the name.** A plugin configured with a password returns a name that does
  not contain it.

## See also

- `core/src/schema/communication/broadcast.ts` — the channel registry and the key this feeds
- `specs/domains.md` — the frozen-interface rule this edits
- `specs/write-batching.md` — the `composition` question, which cited `identity?` as precedent
