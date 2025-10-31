[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / DataStore

# Class: DataStore

Defined in: [datastore/src/DataStore.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L19)

The main Routier class, providing collection management, change tracking, and persistence for entities.

## Implements

Disposable

## Implements

- `Disposable`

## Constructors

### Constructor

> **new DataStore**(`dbPlugin`): `DataStore`

Defined in: [datastore/src/DataStore.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L40)

Constructs a new Routier instance.

#### Parameters

##### dbPlugin

`IDbPlugin`

The database plugin to use for persistence.

#### Returns

`DataStore`

## Accessors

### schemas

#### Get Signature

> **get** **schemas**(): `ReadonlySchemaCollection`

Defined in: [datastore/src/DataStore.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L32)

##### Returns

`ReadonlySchemaCollection`

## Methods

### getDbPlugin()

> **getDbPlugin**\<`T`\>(): `T`

Defined in: [datastore/src/DataStore.ts:51](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L51)

#### Type Parameters

##### T

`T` *extends* `IDbPlugin`

#### Returns

`T`

***

### saveChanges()

> **saveChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:108](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L108)

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

Defined in: [datastore/src/DataStore.ts:168](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L168)

Saves all changes in all collections asynchronously.

#### Returns

`Promise`\<`BulkPersistResult`\>

A promise resolving to the number of changes saved.

***

### previewChanges()

> **previewChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:179](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L179)

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

Defined in: [datastore/src/DataStore.ts:198](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L198)

Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
This method allows inspection of changes before they are actually persisted.

#### Returns

`Promise`\<`BulkPersistChanges`\>

A promise resolving to the entity changes.

***

### hasChanges()

> **hasChanges**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:208](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L208)

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

Defined in: [datastore/src/DataStore.ts:236](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L236)

Checks asynchronously if there are any unsaved changes in the collections.

#### Returns

`Promise`\<`boolean`\>

A promise resolving to true if there are changes, false otherwise.

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [datastore/src/DataStore.ts:254](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L254)

Destroys the Routier instance and underlying database plugin.

#### Parameters

##### done

`CallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

***

### destroyAsync()

> **destroyAsync**(): `Promise`\<`void`\>

Defined in: [datastore/src/DataStore.ts:266](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L266)

Destroys the Routier instance and underlying database plugin asynchronously.

#### Returns

`Promise`\<`void`\>

A promise that resolves when destruction is complete.

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [datastore/src/DataStore.ts:275](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/DataStore.ts#L275)

Disposes the Routier instance, aborting any ongoing operations and subscriptions.

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`
