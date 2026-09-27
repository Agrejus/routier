[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresDbPlugin

# Class: PostgresDbPlugin

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:12](https://github.com/Agrejus/routier/blob/main/plugins/postgresql/src/PostgresDbPlugin.ts#L12)

PostgreSQL over the network, through `node-postgres`.

Everything this plugin does with a statement lives in `@routier/postgres-plugin-core`, which
knows nothing about `pg` and nothing about Node. This class supplies the engine.

## Extends

- [`PostgresDbPluginBase`](PostgresDbPluginBase.md)

## Constructors

### Constructor

> **new PostgresDbPlugin**(`config`): `PostgresDbPlugin`

Defined in: [plugins/postgresql/src/PostgresDbPlugin.ts:13](https://github.com/Agrejus/routier/blob/main/plugins/postgresql/src/PostgresDbPlugin.ts#L13)

#### Parameters

##### config

[`PostgresDbPluginConfig`](../interfaces/PostgresDbPluginConfig.md)

#### Returns

`PostgresDbPlugin`

#### Overrides

[`PostgresDbPluginBase`](PostgresDbPluginBase.md).[`constructor`](PostgresDbPluginBase.md#constructor)

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: plugins/postgres-core/dist/plugin.d.ts:27

See `IDbPlugin.databaseName`. The driver names its own target; see `PostgresDriver`.

#### Inherited from

[`PostgresDbPluginBase`](PostgresDbPluginBase.md).[`databaseName`](PostgresDbPluginBase.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: plugins/postgres-core/dist/plugin.d.ts:78

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

#### Inherited from

[`PostgresDbPluginBase`](PostgresDbPluginBase.md).[`query`](PostgresDbPluginBase.md#query)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: plugins/postgres-core/dist/plugin.d.ts:87

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

#### Inherited from

[`PostgresDbPluginBase`](PostgresDbPluginBase.md).[`bulkPersist`](PostgresDbPluginBase.md#bulkpersist)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: plugins/postgres-core/dist/plugin.d.ts:113

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Inherited from

[`PostgresDbPluginBase`](PostgresDbPluginBase.md).[`destroy`](PostgresDbPluginBase.md#destroy)
