[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/dexie/src](../README.md) / DexiePlugin

# Class: DexiePlugin

Defined in: [plugins/dexie/src/DexiePlugin.ts:46](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L46)

## Implements

- `IDbPlugin`
- `Disposable`

## Constructors

### Constructor

> **new DexiePlugin**(`dbName`, `options?`): `DexiePlugin`

Defined in: [plugins/dexie/src/DexiePlugin.ts:60](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L60)

#### Parameters

##### dbName

`string`

##### options?

`DexiePluginOptions`

#### Returns

`DexiePlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/dexie/src/DexiePlugin.ts:56](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L56)

See `IDbPlugin.databaseName`. IndexedDB names are already scoped to an origin, so the
name alone identifies the database — and two tabs on that origin opening it must share
subscription channels, which is exactly what returning the name gives them.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/dexie/src/DexiePlugin.ts:119](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L119)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:133](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L133)

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

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/dexie/src/DexiePlugin.ts:310](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L310)

Executes a query operation on the database.

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TEntity`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TEntity`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [plugins/dexie/src/DexiePlugin.ts:406](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/dexie/src/DexiePlugin.ts#L406)

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`
