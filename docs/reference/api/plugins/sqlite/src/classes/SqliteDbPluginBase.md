[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteDbPluginBase

# Class: SqliteDbPluginBase

Defined in: [plugins/sqlite/src/plugin.ts:45](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L45)

The engine-independent half of the plugin.

Every statement it runs is built by `utils.ts` and `@routier/sql-plugin-core`, neither of
which knows what a connection is. The concrete `SqliteDbPlugin` each environment exports
differs only in which driver it defaults to.

## Extended by

- [`SqliteDbPlugin`](SqliteDbPlugin.md)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new SqliteDbPluginBase**(`databaseName`, `driver`): `SqliteDbPluginBase`

Defined in: [plugins/sqlite/src/plugin.ts:91](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L91)

#### Parameters

##### databaseName

`string`

##### driver

[`SqliteDriver`](../interfaces/SqliteDriver.md)

#### Returns

`SqliteDbPluginBase`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/sqlite/src/plugin.ts:53](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L53)

See `IDbPlugin.databaseName`. This is the file path as the caller spelled it, which is
as far as a plugin that also runs in the browser can go: resolving it needs a file
system. Two spellings of one file — a relative and an absolute path — therefore read as
two databases and will not share subscription channels. Pass a consistent path.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/sqlite/src/plugin.ts:159](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L159)

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

Defined in: [plugins/sqlite/src/plugin.ts:260](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L260)

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

Defined in: [plugins/sqlite/src/plugin.ts:363](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sqlite/src/plugin.ts#L363)

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
