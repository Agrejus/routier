[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresDbPluginBase

# Class: PostgresDbPluginBase

Defined in: plugins/postgres-core/dist/plugin.d.ts:24

The engine-independent half of the PostgreSQL plugin.

Every statement it runs is built by `utils.ts` and `@routier/sql-plugin-core`, neither of
which knows what a connection is. The concrete plugin each engine exports differs only in
the `PostgresDriver` it is constructed with — `pg` against a server, PGlite against
WebAssembly.

## Extended by

- [`PostgresDbPlugin`](PostgresDbPlugin.md)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new PostgresDbPluginBase**(`driver`): `PostgresDbPluginBase`

Defined in: plugins/postgres-core/dist/plugin.d.ts:45

#### Parameters

##### driver

[`PostgresDriver`](../interfaces/PostgresDriver.md)

#### Returns

`PostgresDbPluginBase`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: plugins/postgres-core/dist/plugin.d.ts:27

See `IDbPlugin.databaseName`. The driver names its own target; see `PostgresDriver`.

#### Implementation of

`IDbPlugin.databaseName`

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

#### Implementation of

`IDbPlugin.query`

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

#### Implementation of

`IDbPlugin.bulkPersist`

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

#### Implementation of

`IDbPlugin.destroy`
