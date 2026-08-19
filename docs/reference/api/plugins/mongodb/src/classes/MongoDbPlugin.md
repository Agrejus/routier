[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoDbPlugin

# Class: MongoDbPlugin

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:50](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L50)

Routier over MongoDB.

Documents are stored as the entity is: Mongo has native nested objects, arrays and dates,
so unlike the SQL plugins there is no JSON column to encode into and no decode on the way
back. That is the whole of the storage story.

## What is pushed down, and what is not

Filters, sort, skip and take reach the server. Everything else — map, group, distinct and
the aggregates — is evaluated by `JsonTranslator`, which is correct on every backend by
construction. Pushing an aggregate into an aggregation pipeline is a later optimisation
with a different risk profile, and doing it badly returns wrong numbers rather than slow
ones.

## Saves are atomic, and what that depends on

`bulkPersist` runs inside `driver.transaction`, so a save spanning two collections either
applies to both or to neither — the datastore's contract, and what the SQL plugins get from
BEGIN/COMMIT.

It depends on the driver. MongoDB transactions need a replica set, and a standalone
`mongod` rejects them outright, so `MongoClientDriver` takes an explicit
`transactions: "required" | "unavailable"` rather than detecting it. A store that lost
atomicity by moving to a standalone would be the worst possible thing to discover quietly.

The driver runs the save exactly once and retries nothing, so there is no transaction
mechanics to reason about here — a conflict fails the save and reaches the caller, the way
it does on every other backend.

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new MongoDbPlugin**(`driver`, `databaseName?`): `MongoDbPlugin`

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:57](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L57)

#### Parameters

##### driver

[`MongoDriver`](../interfaces/MongoDriver.md)

##### databaseName?

`string`

#### Returns

`MongoDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:55](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L55)

See `IDbPlugin.databaseName`. Defaults to the driver's database name.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L64)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:173](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L173)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

`DbPluginBulkPersistEvent`

The bulk operations event containing schema, parent, and changes.

##### done

`PluginEventCallbackPartialResult`\<`BulkPersistResult`\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.bulkPersist`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/mongodb/src/MongoDbPlugin.ts:293](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoDbPlugin.ts#L293)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`
