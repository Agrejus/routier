[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / DataStore

# Class: DataStore

Defined in: [datastore/src/DataStore.ts:47](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L47)

The main Routier class, providing collection management, change tracking, and persistence for entities.

## Implements

Disposable

## Implements

- `Disposable`

## Constructors

### Constructor

> **new DataStore**(`dbPlugin`, `options?`): `DataStore`

Defined in: [datastore/src/DataStore.ts:76](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L76)

Constructs a new Routier instance.

#### Parameters

##### dbPlugin

`IDbPlugin`

The database plugin to use for persistence.

##### options?

[`DataStoreOptions`](../type-aliases/DataStoreOptions.md)

Store-wide settings. Every one has a default; see `DataStoreOptions`.

#### Returns

`DataStore`

## Accessors

### schemas

#### Get Signature

> **get** **schemas**(): `ReadonlySchemaCollection`

Defined in: [datastore/src/DataStore.ts:67](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L67)

##### Returns

`ReadonlySchemaCollection`

## Methods

### getDbPlugin()

> **getDbPlugin**\<`T`\>(): `T`

Defined in: [datastore/src/DataStore.ts:88](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L88)

#### Type Parameters

##### T

`T` *extends* `IDbPlugin`

#### Returns

`T`

***

### getCollection()

> **getCollection**\<`TEntity`\>(`schema`): [`Collection`](Collection.md)\<`TEntity`\>

Defined in: [datastore/src/DataStore.ts:92](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L92)

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

#### Parameters

##### schema

`CompiledSchema`\<`TEntity`\>

#### Returns

[`Collection`](Collection.md)\<`TEntity`\>

***

### saveChanges()

> **saveChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:352](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L352)

Saves all changes in all collections.

#### Parameters

##### done

`CallbackPartialResult`\<`BulkPersistResult`\>

Callback with the number of changes saved or an error.

#### Returns

`void`

***

### saveChangesAsync()

> **saveChangesAsync**(): `Promise`\<`BulkPersistResult`\>

Defined in: [datastore/src/DataStore.ts:383](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L383)

Saves all changes in all collections asynchronously.

#### Returns

`Promise`\<`BulkPersistResult`\>

A promise resolving to the number of changes saved.

***

### previewChanges()

> **previewChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:394](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L394)

Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
This method allows inspection of changes before they are actually persisted.

#### Parameters

##### done

`CallbackPartialResult`\<`BulkPersistChanges`\>

Callback with the entity changes or an error.

#### Returns

`void`

***

### previewChangesAsync()

> **previewChangesAsync**(): `Promise`\<`BulkPersistChanges`\>

Defined in: [datastore/src/DataStore.ts:413](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L413)

Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
This method allows inspection of changes before they are actually persisted.

#### Returns

`Promise`\<`BulkPersistChanges`\>

A promise resolving to the entity changes.

***

### hasChanges()

> **hasChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:423](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L423)

Checks if there are any unsaved changes in the collections.

#### Parameters

##### done

`CallbackResult`\<`boolean`\>

Callback with the result (true if there are changes) or an error.

#### Returns

`void`

***

### hasChangesAsync()

> **hasChangesAsync**(): `Promise`\<`boolean`\>

Defined in: [datastore/src/DataStore.ts:451](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L451)

Checks asynchronously if there are any unsaved changes in the collections.

#### Returns

`Promise`\<`boolean`\>

A promise resolving to true if there are changes, false otherwise.

***

### inspect()

> **inspect**(): [`StoreInspection`](../interfaces/StoreInspection.md)

Defined in: [datastore/src/DataStore.ts:465](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L465)

#### Returns

[`StoreInspection`](../interfaces/StoreInspection.md)

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:485](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L485)

Destroys the Routier instance and underlying database plugin.

Disposes the store as well, once the plugin is done. It used to destroy only the
database, which left every store this process had built holding an open
BroadcastChannel pair — two `MessagePort` handles that keep the Node event loop alive
on their own. That is a large part of why test runs need `--forceExit`: a channel pair
is opened eagerly for each collection, whether or not anything ever subscribes, and
`destroyAsync` is the call that reads like teardown. Only `[Symbol.dispose]` released
them, and nothing said so.

Disposing AFTER the plugin callback rather than before it, because disposing aborts
this store's AbortController and the destroy operation is running under it.

#### Parameters

##### done

`CallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

***

### destroyAsync()

> **destroyAsync**(): `Promise`\<`void`\>

Defined in: [datastore/src/DataStore.ts:501](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L501)

Destroys the Routier instance and underlying database plugin asynchronously.

#### Returns

`Promise`\<`void`\>

A promise that resolves when destruction is complete.

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [datastore/src/DataStore.ts:510](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L510)

Disposes the Routier instance, aborting any ongoing operations and subscriptions.

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`
