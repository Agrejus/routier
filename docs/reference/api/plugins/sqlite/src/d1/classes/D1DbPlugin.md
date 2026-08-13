[**routier-collection**](../../../../../README.md)

***

[routier-collection](../../../../../README.md) / [plugins/sqlite/src/d1](../README.md) / D1DbPlugin

# Class: D1DbPlugin

Defined in: [plugins/sqlite/src/d1.ts:107](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L107)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new D1DbPlugin**(`database`, `options`): `D1DbPlugin`

Defined in: [plugins/sqlite/src/d1.ts:122](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L122)

#### Parameters

##### database

[`D1Database`](../interfaces/D1Database.md)

##### options

[`D1DbPluginOptions`](../type-aliases/D1DbPluginOptions.md) = `{}`

#### Returns

`D1DbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/sqlite/src/d1.ts:120](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L120)

See `IDbPlugin.databaseName` and `D1DbPluginOptions.databaseName`.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/sqlite/src/d1.ts:194](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L194)

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

Defined in: [plugins/sqlite/src/d1.ts:328](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L328)

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

Defined in: [plugins/sqlite/src/d1.ts:438](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/d1.ts#L438)

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
