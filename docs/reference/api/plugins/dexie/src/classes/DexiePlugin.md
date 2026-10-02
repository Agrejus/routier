[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/dexie/src](../README.md) / DexiePlugin

# Class: DexiePlugin

Defined in: [plugins/dexie/src/DexiePlugin.ts:51](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L51)

## Implements

- `IDbPlugin`
- `Disposable`

## Constructors

### Constructor

> **new DexiePlugin**(`dbName`, `options?`): `DexiePlugin`

Defined in: [plugins/dexie/src/DexiePlugin.ts:65](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L65)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:61](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L61)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:124](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L124)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:138](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L138)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:307](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L307)

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

Defined in: [plugins/dexie/src/DexiePlugin.ts:499](https://github.com/Agrejus/routier/blob/main/plugins/dexie/src/DexiePlugin.ts#L499)

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`
