[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / Collection

# Class: Collection\<TEntity\>

Defined in: [datastore/src/collections/Collection.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L9)

## Extends

- `RemovableCollection`\<`TEntity`\>

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Constructors

### Constructor

> **new Collection**\<`TEntity`\>(`dbPlugin`, `schema`, `options`, `pipelines`, `schemas`, `queryOptions`): `Collection`\<`TEntity`\>

Defined in: [datastore/src/collections/Collection.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L11)

#### Parameters

##### dbPlugin

`IDbPlugin`

##### schema

`CompiledSchema`\<`TEntity`\>

##### options

`CollectionOptions`

##### pipelines

`CollectionPipelines`

##### schemas

`SchemaCollection`

##### queryOptions

`QueryOptionsCollection`\<`InferType`\<`TEntity`\>\>

#### Returns

`Collection`\<`TEntity`\>

#### Overrides

`RemovableCollection<TEntity>.constructor`

## Properties

### tags

> **tags**: `object`

Defined in: [datastore/src/collections/Collection.ts:41](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L41)

#### get()

> **get**: () => `TagCollection`

##### Returns

`TagCollection`

#### destroy()

> **destroy**: () => `void`

##### Returns

`void`

***

### attachments

> **attachments**: `object`

Defined in: [datastore/src/collections/Collection.ts:51](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L51)

#### remove()

> **remove**: (...`entities`) => `InferType`\<`TEntity`\>[]

Detaches entities from change tracking, removing them from the collection's managed set

##### Parameters

###### entities

...`InferType`\<`TEntity`\>[]

##### Returns

`InferType`\<`TEntity`\>[]

#### set()

> **set**: (...`entities`) => `InferType`\<`TEntity`\>[]

Attaches entities to change tracking, enabling property change monitoring and dirty state management

##### Parameters

###### entities

...`InferType`\<`TEntity`\>[]

##### Returns

`InferType`\<`TEntity`\>[]

#### has()

> **has**: (`entity`) => `boolean`

Checks if an entity is currently attached to change tracking

##### Parameters

###### entity

`InferType`\<`TEntity`\>

##### Returns

`boolean`

#### get()

> **get**: (`entity`) => `InferType`\<`TEntity`\>

Retrieves an attached entity from change tracking if it exists

##### Parameters

###### entity

`InferType`\<`TEntity`\>

##### Returns

`InferType`\<`TEntity`\>

#### filter()

> **filter**: (`selector`) => `InferType`\<`TEntity`\>[]

Filters attached entities using a selector function, returning entities that match the criteria

##### Parameters

###### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `boolean`\>

##### Returns

`InferType`\<`TEntity`\>[]

#### find()

> **find**: (`selector`) => `InferType`\<`TEntity`\>

Finds attached entity using a selector function, returning first entity that matches the criteria

##### Parameters

###### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `boolean`\>

##### Returns

`InferType`\<`TEntity`\>

#### markDirty()

> **markDirty**: (...`entities`) => `void`

Marks entities as dirty, forcing them to be included in the next save operation regardless of actual property changes

##### Parameters

###### entities

...`InferType`\<`TEntity`\>[]

##### Returns

`void`

#### getChangeType()

> **getChangeType**: (`entity`) => `EntityChangeType`

Retrieves the change type for a specific entity. Returns the change type if attached, or undefined if not attached.

##### Parameters

###### entity

`InferType`\<`TEntity`\>

##### Returns

`EntityChangeType`

***

### schema

> `readonly` **schema**: `CompiledSchema`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L22)

#### Inherited from

`RemovableCollection.schema`

***

### schemas

> `readonly` **schemas**: `SchemaCollection`

Defined in: [datastore/src/collections/CollectionBase.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L23)

#### Inherited from

`RemovableCollection.schemas`

***

### scopedQueryOptions

> **scopedQueryOptions**: `QueryOptionsCollection`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L26)

#### Inherited from

`RemovableCollection.scopedQueryOptions`

## Methods

### add()

> **add**(`entities`, `done`): `void`

Defined in: [datastore/src/collections/Collection.ts:102](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L102)

Adds entities to the collection and persists them to the database.

#### Parameters

##### entities

`InferCreateType`\<`TEntity`\>[]

Array of entities to add to the collection

##### done

`CallbackResult`\<`InferType`\<`TEntity`\>[]\>

Callback function called with the added entities or error

#### Returns

`void`

***

### addAsync()

> **addAsync**(...`entities`): `Promise`\<`InferType`\<`TEntity`\>[]\>

Defined in: [datastore/src/collections/Collection.ts:112](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L112)

Adds entities to the collection asynchronously and returns a Promise.

#### Parameters

##### entities

...`InferCreateType`\<`TEntity`\>[]

Entities to add to the collection

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves with the added entities or rejects with an error

***

### tag()

> **tag**(`tag`): `Collection`\<`TEntity`\>

Defined in: [datastore/src/collections/Collection.ts:121](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/Collection.ts#L121)

Sets a tag for the next operation. The tag will be used to group related operations.

#### Parameters

##### tag

`unknown`

The tag to associate with the next operation

#### Returns

`Collection`\<`TEntity`\>

The collection instance for method chaining

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:80](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L80)

#### Returns

`void`

#### Inherited from

`RemovableCollection.[dispose]`

***

### dispose()

> **dispose**(): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:84](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L84)

#### Returns

`void`

#### Inherited from

`RemovableCollection.dispose`

***

### hasChanges()

> **hasChanges**(): `boolean`

Defined in: [datastore/src/collections/CollectionBase.ts:263](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L263)

#### Returns

`boolean`

#### Inherited from

`RemovableCollection.hasChanges`

***

### instance()

> **instance**(...`entities`): `InferCreateType`\<`TEntity`\>[]

Defined in: [datastore/src/collections/CollectionBase.ts:272](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L272)

Creates change-tracked instances of entities without adding them to the collection.

#### Parameters

##### entities

...`InferCreateType`\<`TEntity`\>[]

Entities to create change-tracked instances for

#### Returns

`InferCreateType`\<`TEntity`\>[]

Array of change-tracked entity instances

#### Inherited from

`RemovableCollection.instance`

***

### subscribe()

> **subscribe**(): `SubscribedQueryable`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>, () => `void`\>

Defined in: [datastore/src/collections/CollectionBase.ts:287](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L287)

Creates a subscription to the collection that will be notified of changes.

#### Returns

`SubscribedQueryable`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>, () => `void`\>

A subscription object that can be used to listen for collection changes

#### Inherited from

`RemovableCollection.subscribe`

***

### defer()

> **defer**(): `Queryable`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>, () => `void`\>

Defined in: [datastore/src/collections/CollectionBase.ts:298](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L298)

Ignores the first execution of the resulting query

#### Returns

`Queryable`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>, () => `void`\>

#### Inherited from

`RemovableCollection.defer`

***

### where()

#### Call Signature

> **where**(`expression`): `QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:311](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L311)

Creates a query with a filter expression to filter entities in the collection.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply to the collection

##### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

##### Inherited from

`RemovableCollection.where`

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:318](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L318)

Creates a query with a parameterized filter to filter entities in the collection.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### selector

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

Parameterized filter function

###### params

`P`

Parameters to pass to the filter function

##### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

##### Inherited from

`RemovableCollection.where`

***

### sort()

> **sort**(`selector`): `QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:342](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L342)

Sorts the collection by the specified property in ascending order.

#### Parameters

##### selector

`EntityMap`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\[keyof `InferType`\<`TEntity`\>\]\>

Function that selects the property to sort by

#### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.sort`

***

### sortDescending()

> **sortDescending**(`selector`): `QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:355](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L355)

Sorts the collection by the specified property in descending order.

#### Parameters

##### selector

`EntityMap`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\[keyof `InferType`\<`TEntity`\>\]\>

Function that selects the property to sort by

#### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.sortDescending`

***

### map()

> **map**\<`R`\>(`expression`): `QueryableAsync`\<`InferType`\<`TEntity`\>, `R`\>

Defined in: [datastore/src/collections/CollectionBase.ts:369](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L369)

Maps the collection to a new shape using the specified transformation function.

#### Type Parameters

##### R

`R`

#### Parameters

##### expression

`EntityMap`\<`InferType`\<`TEntity`\>, `R`\>

Function that transforms each entity to the new shape

#### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `R`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.map`

***

### skip()

> **skip**(`amount`): `SkippedQueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:382](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L382)

Skips the specified number of entities in the collection.

#### Parameters

##### amount

`number`

Number of entities to skip

#### Returns

`SkippedQueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.skip`

***

### take()

> **take**(`amount`): `TakeQueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:395](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L395)

Takes the specified number of entities from the collection.

#### Parameters

##### amount

`number`

Number of entities to take

#### Returns

`TakeQueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.take`

***

### toQueryable()

> **toQueryable**(): `QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:408](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L408)

Converts the collection to a QueryableAsync instance for building queries dynamically.
This is useful when you need to conditionally build queries by chaining operations based on logic.

#### Returns

`QueryableAsync`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.toQueryable`

***

### toArray()

> **toArray**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:419](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L419)

Executes the query and returns all results as an array.

#### Parameters

##### done

`CallbackResult`\<`InferType`\<`TEntity`\>[]\>

Callback function called with the array of entities or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.toArray`

***

### toArrayAsync()

> **toArrayAsync**(): `Promise`\<`InferType`\<`TEntity`\>[]\>

Defined in: [datastore/src/collections/CollectionBase.ts:431](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L431)

Executes the query asynchronously and returns all results as an array.

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves with the array of entities or rejects with an error

#### Inherited from

`RemovableCollection.toArrayAsync`

***

### first()

#### Call Signature

> **first**(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:444](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L444)

Returns the first entity that matches the filter expression.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first matching entity or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.first`

#### Call Signature

> **first**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:451](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L451)

Returns the first entity that matches the parameterized filter.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first matching entity or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.first`

#### Call Signature

> **first**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:456](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L456)

Returns the first entity in the collection.

##### Parameters

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first entity or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.first`

***

### firstAsync()

#### Call Signature

> **firstAsync**(`expression`): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:485](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L485)

Returns the first entity that matches the filter expression asynchronously.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first matching entity or rejects with an error

##### Inherited from

`RemovableCollection.firstAsync`

#### Call Signature

> **firstAsync**\<`P`\>(`expression`, `params`): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:492](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L492)

Returns the first entity that matches the parameterized filter asynchronously.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first matching entity or rejects with an error

##### Inherited from

`RemovableCollection.firstAsync`

#### Call Signature

> **firstAsync**(): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:497](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L497)

Returns the first entity in the collection asynchronously.

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first entity or rejects with an error

##### Inherited from

`RemovableCollection.firstAsync`

***

### firstOrUndefined()

#### Call Signature

> **firstOrUndefined**(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:523](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L523)

Returns the first entity that matches the filter expression, or undefined if none found.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first matching entity, undefined, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:530](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L530)

Returns the first entity that matches the parameterized filter, or undefined if none found.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first matching entity, undefined, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:535](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L535)

Returns the first entity in the collection, or undefined if empty.

##### Parameters

###### done

`CallbackResult`\<`InferType`\<`TEntity`\>\>

Callback function called with the first entity, undefined, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.firstOrUndefined`

***

### firstOrUndefinedAsync()

#### Call Signature

> **firstOrUndefinedAsync**(`expression`): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:564](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L564)

Returns the first entity that matches the filter expression asynchronously, or undefined if none found.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first matching entity, undefined, or rejects with an error

##### Inherited from

`RemovableCollection.firstOrUndefinedAsync`

#### Call Signature

> **firstOrUndefinedAsync**\<`P`\>(`expression`, `params`): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:571](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L571)

Returns the first entity that matches the parameterized filter asynchronously, or undefined if none found.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first matching entity, undefined, or rejects with an error

##### Inherited from

`RemovableCollection.firstOrUndefinedAsync`

#### Call Signature

> **firstOrUndefinedAsync**(): `Promise`\<`InferType`\<`TEntity`\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:576](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L576)

Returns the first entity in the collection asynchronously, or undefined if empty.

##### Returns

`Promise`\<`InferType`\<`TEntity`\>\>

Promise that resolves with the first entity, undefined, or rejects with an error

##### Inherited from

`RemovableCollection.firstOrUndefinedAsync`

***

### some()

#### Call Signature

> **some**(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:602](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L602)

Checks if any entity matches the filter expression.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if any entity matches, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.some`

#### Call Signature

> **some**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:609](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L609)

Checks if any entity matches the parameterized filter.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if any entity matches, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.some`

#### Call Signature

> **some**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:614](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L614)

Checks if the collection has any entities.

##### Parameters

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if collection has entities, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.some`

***

### someAsync()

#### Call Signature

> **someAsync**(`expression`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:643](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L643)

Checks if any entity matches the filter expression asynchronously.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if any entity matches, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.someAsync`

#### Call Signature

> **someAsync**\<`P`\>(`expression`, `params`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:650](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L650)

Checks if any entity matches the parameterized filter asynchronously.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

###### params

`P`

Parameters to pass to the filter function

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if any entity matches, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.someAsync`

#### Call Signature

> **someAsync**(): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:655](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L655)

Checks if the collection has any entities asynchronously.

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if collection has entities, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.someAsync`

***

### every()

#### Call Signature

> **every**(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:681](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L681)

Checks if all entities match the filter expression.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if all entities match, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.every`

#### Call Signature

> **every**\<`P`\>(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:688](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L688)

Checks if all entities match the parameterized filter.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if all entities match, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.every`

#### Call Signature

> **every**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:689](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L689)

Checks if all entities match the filter expression.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

Filter expression to apply

###### params

`P`

###### done

`CallbackResult`\<`boolean`\>

Callback function called with true if all entities match, false otherwise, or error

##### Returns

`void`

##### Inherited from

`RemovableCollection.every`

***

### everyAsync()

#### Call Signature

> **everyAsync**(`expression`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:713](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L713)

Checks if all entities match the filter expression asynchronously.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if all entities match, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.everyAsync`

#### Call Signature

> **everyAsync**\<`P`\>(`expression`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:720](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L720)

Checks if all entities match the parameterized filter asynchronously.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if all entities match, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.everyAsync`

#### Call Signature

> **everyAsync**\<`P`\>(`expression`, `params`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:721](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L721)

Checks if all entities match the filter expression asynchronously.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`InferType`\<`TEntity`\>, `P`\>

Filter expression to apply

###### params

`P`

##### Returns

`Promise`\<`boolean`\>

Promise that resolves with true if all entities match, false otherwise, or rejects with an error

##### Inherited from

`RemovableCollection.everyAsync`

***

### min()

> **min**(`selector`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:743](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L743)

Finds the minimum value of the specified numeric property across all entities.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to find the minimum of

##### done

`CallbackResult`\<`number`\>

Callback function called with the minimum value or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.min`

***

### minAsync()

> **minAsync**(`selector`): `Promise`\<`number`\>

Defined in: [datastore/src/collections/CollectionBase.ts:757](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L757)

Finds the minimum value of the specified numeric property across all entities asynchronously.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to find the minimum of

#### Returns

`Promise`\<`number`\>

Promise that resolves with the minimum value or rejects with an error

#### Inherited from

`RemovableCollection.minAsync`

***

### max()

> **max**(`selector`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:771](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L771)

Finds the maximum value of the specified numeric property across all entities.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to find the maximum of

##### done

`CallbackResult`\<`number`\>

Callback function called with the maximum value or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.max`

***

### maxAsync()

> **maxAsync**(`selector`): `Promise`\<`number`\>

Defined in: [datastore/src/collections/CollectionBase.ts:785](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L785)

Finds the maximum value of the specified numeric property across all entities asynchronously.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to find the maximum of

#### Returns

`Promise`\<`number`\>

Promise that resolves with the maximum value or rejects with an error

#### Inherited from

`RemovableCollection.maxAsync`

***

### sum()

> **sum**(`selector`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:799](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L799)

Calculates the sum of the specified numeric property across all entities.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to sum

##### done

`CallbackResult`\<`number`\>

Callback function called with the sum or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.sum`

***

### sumAsync()

> **sumAsync**(`selector`): `Promise`\<`number`\>

Defined in: [datastore/src/collections/CollectionBase.ts:813](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L813)

Calculates the sum of the specified numeric property across all entities asynchronously.

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `number`\>

Function that selects the numeric property to sum

#### Returns

`Promise`\<`number`\>

Promise that resolves with the sum or rejects with an error

#### Inherited from

`RemovableCollection.sumAsync`

***

### count()

> **count**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:826](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L826)

Counts the number of entities in the collection.

#### Parameters

##### done

`CallbackResult`\<`number`\>

Callback function called with the count or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.count`

***

### countAsync()

> **countAsync**(): `Promise`\<`number`\>

Defined in: [datastore/src/collections/CollectionBase.ts:839](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L839)

Counts the number of entities in the collection asynchronously.

#### Returns

`Promise`\<`number`\>

Promise that resolves with the count or rejects with an error

#### Inherited from

`RemovableCollection.countAsync`

***

### distinct()

> **distinct**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:852](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L852)

Returns distinct entities from the collection, removing duplicates.

#### Parameters

##### done

`CallbackResult`\<`InferType`\<`TEntity`\>[]\>

Callback function called with the distinct entities or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.distinct`

***

### distinctAsync()

> **distinctAsync**(): `Promise`\<`InferType`\<`TEntity`\>[]\>

Defined in: [datastore/src/collections/CollectionBase.ts:865](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/CollectionBase.ts#L865)

Returns distinct entities from the collection asynchronously, removing duplicates.

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves with the distinct entities or rejects with an error

#### Inherited from

`RemovableCollection.distinctAsync`

***

### remove()

> **remove**(`entities`, `done`): `void`

Defined in: [datastore/src/collections/RemovableCollection.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/RemovableCollection.ts#L32)

Removes entities from the collection and persists the changes to the database.

#### Parameters

##### entities

`InferType`\<`TEntity`\>[]

Array of entities to remove from the collection

##### done

`CallbackResult`\<`InferType`\<`TEntity`\>[]\>

Callback function called with the removed entities or error

#### Returns

`void`

#### Inherited from

`RemovableCollection.remove`

***

### removeAsync()

> **removeAsync**(...`entities`): `Promise`\<`InferType`\<`TEntity`\>[]\>

Defined in: [datastore/src/collections/RemovableCollection.ts:42](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/RemovableCollection.ts#L42)

Removes entities from the collection asynchronously and returns a Promise.

#### Parameters

##### entities

...`InferType`\<`TEntity`\>[]

Entities to remove from the collection

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves with the removed entities or rejects with an error

#### Inherited from

`RemovableCollection.removeAsync`

***

### removeAll()

> **removeAll**(`done`): `void`

Defined in: [datastore/src/collections/RemovableCollection.ts:52](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/RemovableCollection.ts#L52)

Removes all entities from the collection and persists the changes to the database.

#### Parameters

##### done

(`error?`) => `void`

Callback function called when the operation completes or with an error

#### Returns

`void`

#### Inherited from

`RemovableCollection.removeAll`

***

### removeAllAsync()

> **removeAllAsync**(): `Promise`\<`void`\>

Defined in: [datastore/src/collections/RemovableCollection.ts:65](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/datastore/src/collections/RemovableCollection.ts#L65)

Removes all entities from the collection asynchronously and returns a Promise.

#### Returns

`Promise`\<`void`\>

Promise that resolves when the operation completes or rejects with an error

#### Inherited from

`RemovableCollection.removeAllAsync`
