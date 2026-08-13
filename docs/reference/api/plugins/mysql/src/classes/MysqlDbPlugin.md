[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mysql/src](../README.md) / MysqlDbPlugin

# Class: MysqlDbPlugin

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:69](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L69)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new MysqlDbPlugin**(`config`): `MysqlDbPlugin`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:80](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L80)

#### Parameters

##### config

[`MysqlDbPluginConfig`](../interfaces/MysqlDbPluginConfig.md)

#### Returns

`MysqlDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:78](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L78)

See `IDbPlugin.databaseName`. Host, port and database rather than the bare name,
because `mydb` on two servers is two databases.

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:130](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L130)

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

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:219](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L219)

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

Defined in: [plugins/mysql/src/MysqlDbPlugin.ts:227](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mysql/src/MysqlDbPlugin.ts#L227)

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
