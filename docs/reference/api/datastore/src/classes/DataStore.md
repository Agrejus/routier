[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / DataStore

# Class: DataStore

Defined in: [datastore/src/DataStore.ts:60](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L60)

The main Routier class, providing collection management, change tracking, and persistence for entities.

## Implements

Disposable

## Implements

- `Disposable`

## Constructors

### Constructor

> **new DataStore**(`dbPlugin`, `options?`): `DataStore`

Defined in: [datastore/src/DataStore.ts:89](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L89)

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

Defined in: [datastore/src/DataStore.ts:80](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L80)

##### Returns

`ReadonlySchemaCollection`

## Methods

### getDbPlugin()

> **getDbPlugin**\<`T`\>(): `T`

Defined in: [datastore/src/DataStore.ts:101](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L101)

#### Type Parameters

##### T

`T` *extends* `IDbPlugin`

#### Returns

`T`

***

### getCollection()

> **getCollection**\<`TEntity`\>(`schema`): [`Collection`](Collection.md)\<`TEntity`\>

Defined in: [datastore/src/DataStore.ts:105](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L105)

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

Defined in: [datastore/src/DataStore.ts:365](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L365)

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

Defined in: [datastore/src/DataStore.ts:396](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L396)

Saves all changes in all collections asynchronously.

#### Returns

`Promise`\<`BulkPersistResult`\>

A promise resolving to the number of changes saved.

***

### previewChanges()

> **previewChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:407](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L407)

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

Defined in: [datastore/src/DataStore.ts:426](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L426)

Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
This method allows inspection of changes before they are actually persisted.

#### Returns

`Promise`\<`BulkPersistChanges`\>

A promise resolving to the entity changes.

***

### hasChanges()

> **hasChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:436](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L436)

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

Defined in: [datastore/src/DataStore.ts:464](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L464)

Checks asynchronously if there are any unsaved changes in the collections.

#### Returns

`Promise`\<`boolean`\>

A promise resolving to true if there are changes, false otherwise.

***

### inspect()

> **inspect**(): [`StoreInspection`](../interfaces/StoreInspection.md)

Defined in: [datastore/src/DataStore.ts:478](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L478)

#### Returns

[`StoreInspection`](../interfaces/StoreInspection.md)

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:498](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L498)

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

Defined in: [datastore/src/DataStore.ts:514](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L514)

Destroys the Routier instance and underlying database plugin asynchronously.

#### Returns

`Promise`\<`void`\>

A promise that resolves when destruction is complete.

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [datastore/src/DataStore.ts:523](https://github.com/Agrejus/routier/blob/main/datastore/src/DataStore.ts#L523)

Disposes the Routier instance, aborting any ongoing operations and subscriptions.

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`
