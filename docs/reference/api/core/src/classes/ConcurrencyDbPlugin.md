[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ConcurrencyDbPlugin

# Class: ConcurrencyDbPlugin

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:57](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L57)

Optimistic concurrency as a wrapper plugin — the whole opt-in is one wrap:

```ts
class Bank extends DataStore {
    constructor() {
        super(new ConcurrencyDbPlugin(new SqlitePlugin('bank.db')));
    }
}
```

Nothing is declared on the schema and nothing on the collection builder: the plugin
maintains a hidden `__version` column in the SAME tables/records as the data, entirely
below the entity surface. Rows start at version 1; every update is applied ONLY IF the
stored version still matches what this store last read (and bumps it); a stale write
rejects the save with `OptimisticConcurrencyError` naming the rows instead of silently
overwriting another writer. Recovery is always: re-read, reapply, save again.

## How the hidden column exists without schema changes

The wrapper hands the inner plugin an AUGMENTED VIEW of each compiled schema — the same
object via prototype delegation, with one synthetic `__version` property appended to
`properties`. That list is exactly what the storage plugins read to build DDL, INSERT
and SELECT column lists, so the column materializes and round-trips through completely
unmodified plugin code. Above the wrapper the real schema is untouched, and the
datastore's generated deserialize/enrich drop undeclared fields, so `__version` never
reaches an entity a caller holds.

The synthetic property carries `from: '__version'` on purpose: EphemeralDataPlugin
deep-copies query results with `structuredClone` (rather than the generated clone, which
drops undeclared fields) when any property is renamed — which is what lets the hidden
column survive reads from the in-process plugins so this wrapper can observe it.

## What this store "read"

`expected` is per store instance: the version this wrapper last saw for the row, from a
query result or a persist echo. A row updated WITHOUT ever being read through this store
(rare — an attach of a foreign instance) has no expected value and is written unchecked,
initializing its token; the row is protected from the next read on.

## Enforcement and limits

The conditional check itself is performed by the INNER plugin via the
`EntityUpdateInfo.concurrency` contract — memory, file-system, sqlite and postgresql
enforce it (see specs/optimistic-concurrency.md for the not-yet list). Existing SQL
tables created before the wrapper was adopted lack the column and need
`ALTER TABLE ... ADD COLUMN "__version" <number type>` — new tables get it from the
augmented DDL automatically.

## Implements

- [`IDbPlugin`](../interfaces/IDbPlugin.md)

## Constructors

### Constructor

> **new ConcurrencyDbPlugin**(`plugin`): `ConcurrencyDbPlugin`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:67](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L67)

#### Parameters

##### plugin

[`IDbPlugin`](../interfaces/IDbPlugin.md)

#### Returns

`ConcurrencyDbPlugin`

## Properties

### VERSION\_COLUMN

> `readonly` `static` **VERSION\_COLUMN**: `"__version"` = `"__version"`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:59](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L59)

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:71](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L71)

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

##### Returns

`string`

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`databaseName`](../interfaces/IDbPlugin.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:75](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L75)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`query`](../interfaces/IDbPlugin.md#query)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:100](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L100)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](../type-aliases/DbPluginBulkPersistEvent.md)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](../type-aliases/PluginEventCallbackPartialResult.md)\<[`BulkPersistResult`](BulkPersistResult.md)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`bulkPersist`](../interfaces/IDbPlugin.md#bulkpersist)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/ConcurrencyDbPlugin.ts:180](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/ConcurrencyDbPlugin.ts#L180)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](../type-aliases/DbPluginEvent.md)

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`destroy`](../interfaces/IDbPlugin.md#destroy)
