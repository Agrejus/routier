[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteDbPlugin

# Class: SqliteDbPlugin

Defined in: [plugins/sqlite/src/index.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/index.ts#L21)

SQLite for Node, on `node:sqlite`.

This entry point is selected by the `node` condition in the package manifest. A browser
bundler resolves the `browser` condition instead and gets the WASM build, so neither
environment ever loads the other's engine.

Needs Node 22.5 or later. On Node 18 or 20, pass the sqlite3 driver:

  import { sqlite3Driver } from '@routier/sqlite-plugin/drivers/sqlite3';
  new SqliteDbPlugin('app.db', { driver: sqlite3Driver() });

## Extends

- [`SqliteDbPluginBase`](SqliteDbPluginBase.md)

## Constructors

### Constructor

> **new SqliteDbPlugin**(`databaseName`, `options`): `SqliteDbPlugin`

Defined in: [plugins/sqlite/src/index.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/index.ts#L22)

#### Parameters

##### databaseName

`string`

##### options

[`SqliteDbPluginOptions`](../type-aliases/SqliteDbPluginOptions.md) = `{}`

#### Returns

`SqliteDbPlugin`

#### Overrides

[`SqliteDbPluginBase`](SqliteDbPluginBase.md).[`constructor`](SqliteDbPluginBase.md#constructor)

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/sqlite/src/plugin.ts:53](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L53)

See `IDbPlugin.databaseName`. This is the file path as the caller spelled it, which is
as far as a plugin that also runs in the browser can go: resolving it needs a file
system. Two spellings of one file — a relative and an absolute path — therefore read as
two databases and will not share subscription channels. Pass a consistent path.

#### Inherited from

[`SqliteDbPluginBase`](SqliteDbPluginBase.md).[`databaseName`](SqliteDbPluginBase.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/sqlite/src/plugin.ts:159](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L159)

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

[`SqliteDbPluginBase`](SqliteDbPluginBase.md).[`query`](SqliteDbPluginBase.md#query)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/sqlite/src/plugin.ts:254](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L254)

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

[`SqliteDbPluginBase`](SqliteDbPluginBase.md).[`bulkPersist`](SqliteDbPluginBase.md#bulkpersist)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/sqlite/src/plugin.ts:357](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L357)

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

[`SqliteDbPluginBase`](SqliteDbPluginBase.md).[`destroy`](SqliteDbPluginBase.md#destroy)
