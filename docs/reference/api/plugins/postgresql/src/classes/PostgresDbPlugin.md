[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresDbPlugin

# Class: PostgresDbPlugin

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:46](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L46)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new PostgresDbPlugin**(`config`): `PostgresDbPlugin`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:70](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L70)

#### Parameters

##### config

[`PostgresDbPluginConfig`](../interfaces/PostgresDbPluginConfig.md)

#### Returns

`PostgresDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:68](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L68)

See `IDbPlugin.databaseName`. Host, port and database rather than the bare database
name, because `mydb` on two servers is two databases — and without credentials,
because this value becomes part of a subscription channel key.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:164](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L164)

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

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:263](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L263)

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

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:275](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresDbPlugin.ts#L275)

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
