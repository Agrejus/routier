[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / Collection

# Class: Collection\<TEntity, TStore\>

Defined in: [datastore/src/collections/Collection.ts:7](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L7)

## Extends

- `RemovableCollection`\<`TEntity`, `TStore`\>

## Type Parameters

### TEntity

`TEntity` *extends* `object`

### TStore

`TStore` = `unknown`

## Constructors

### Constructor

> **new Collection**\<`TEntity`, `TStore`\>(`dependencies`): `Collection`\<`TEntity`, `TStore`\>

Defined in: [datastore/src/collections/Collection.ts:13](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L13)

#### Parameters

##### dependencies

`CollectionDependencies`\<`TEntity`\>

#### Returns

`Collection`\<`TEntity`, `TStore`\>

#### Overrides

`RemovableCollection<TEntity, TStore>.constructor`

## Properties

### tags

> **tags**: `object`

Defined in: [datastore/src/collections/Collection.ts:38](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L38)

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

Defined in: [datastore/src/collections/Collection.ts:48](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L48)

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

Attaches entities to change tracking, enabling property change monitoring and
dirty state management. The given instances become the canonical attachments —
an explicit set means the caller will mutate THESE instances, so a previously
attached copy of the same entity (e.g. via a background query) is merged into
them and replaced rather than kept.

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

### fullTextSearch

> **fullTextSearch**: `object`

Defined in: [datastore/src/collections/CollectionBase.ts:39](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L39)

Operating the collection's search index — declared with `.fullTextSearch()` on the
builder, operated here.

```ts
const drift = await store.articles.fullTextSearch.check();
if (drift.isHealthy === false) await store.articles.fullTextSearch.rebuild();
```

Both throw on a collection that never declared an index, rather than reporting a healthy
index that does not exist.

#### check()

> **check**: () => `Promise`\<\{ `missing`: `number`; `extra`: `number`; `stale`: `number`; get `isHealthy`(): `boolean`; \}\>

What is wrong with the index, changing nothing.

A scheduled job should call this before `rebuild`: a repair that silently fixes drift
also hides whatever caused it.

##### Returns

`Promise`\<\{ `missing`: `number`; `extra`: `number`; `stale`: `number`; get `isHealthy`(): `boolean`; \}\>

#### rebuild()

> **rebuild**: () => `Promise`\<\{ `added`: `number`; `updated`: `number`; `removed`: `number`; \}\>

Makes the index match the documents, writing only the differences.

Idempotent and safe to run on a schedule. Reads every document, so it belongs in a
scheduled job rather than on a request path.

##### Returns

`Promise`\<\{ `added`: `number`; `updated`: `number`; `removed`: `number`; \}\>

#### Inherited from

`RemovableCollection.fullTextSearch`

## Accessors

### schema

#### Get Signature

> **get** **schema**(): `CompiledSchema`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:23](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L23)

##### Returns

`CompiledSchema`\<`TEntity`\>

#### Inherited from

`RemovableCollection.schema`

## Methods

### add()

> **add**(`entities`, `done`): `void`

Defined in: [datastore/src/collections/Collection.ts:105](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L105)

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

Defined in: [datastore/src/collections/Collection.ts:115](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L115)

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

> **tag**(`tag`): `Collection`\<`TEntity`, `TStore`\>

Defined in: [datastore/src/collections/Collection.ts:124](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/Collection.ts#L124)

Sets a tag for the next operation. The tag will be used to group related operations.

#### Parameters

##### tag

`unknown`

The tag to associate with the next operation

#### Returns

`Collection`\<`TEntity`, `TStore`\>

The collection instance for method chaining

***

### search()

#### Call Signature

> **search**(`terms`, `options?`): `SearchQueryable`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:77](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L77)

Ranked full-text search over the properties marked `.searchable()`.

```ts
const hits = await store.articles
    .search('copper pipe')
    .where(x => x.published === true)
    .take(10)
    .toArrayAsync();

const loose = await store.articles
    .search(x => x.body, 'copper pipe', { match: 'any' })
    .toArrayAsync();
```

Results carry a readonly `score` and are ordered by it, then by key. `map()` drops the
score; `sort()` replaces the ranking. Requires `.fullTextSearch()` on the collection.

##### Parameters

###### terms

`string`

###### options?

`SearchOptions`

##### Returns

`SearchQueryable`\<`TEntity`\>

##### Inherited from

`RemovableCollection.search`

#### Call Signature

> **search**(`selector`, `terms`, `options?`): `SearchQueryable`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:78](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L78)

Ranked full-text search over the properties marked `.searchable()`.

```ts
const hits = await store.articles
    .search('copper pipe')
    .where(x => x.published === true)
    .take(10)
    .toArrayAsync();

const loose = await store.articles
    .search(x => x.body, 'copper pipe', { match: 'any' })
    .toArrayAsync();
```

Results carry a readonly `score` and are ordered by it, then by key. `map()` drops the
score; `sort()` replaces the ranking. Requires `.fullTextSearch()` on the collection.

##### Parameters

###### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `string`\>

###### terms

`string`

###### options?

`SearchOptions`

##### Returns

`SearchQueryable`\<`TEntity`\>

##### Inherited from

`RemovableCollection.search`

#### Call Signature

> **search**(`selectors`, `terms`, `options?`): `SearchQueryable`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:79](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L79)

Ranked full-text search over the properties marked `.searchable()`.

```ts
const hits = await store.articles
    .search('copper pipe')
    .where(x => x.published === true)
    .take(10)
    .toArrayAsync();

const loose = await store.articles
    .search(x => x.body, 'copper pipe', { match: 'any' })
    .toArrayAsync();
```

Results carry a readonly `score` and are ordered by it, then by key. `map()` drops the
score; `sort()` replaces the ranking. Requires `.fullTextSearch()` on the collection.

##### Parameters

###### selectors

`GenericFunction`\<`InferType`\<`TEntity`\>, `string`\>[]

###### terms

`string`

###### options?

`SearchOptions`

##### Returns

`SearchQueryable`\<`TEntity`\>

##### Inherited from

`RemovableCollection.search`

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:160](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L160)

#### Returns

`void`

#### Inherited from

`RemovableCollection.[dispose]`

***

### dispose()

> **dispose**(): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:164](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L164)

#### Returns

`void`

#### Inherited from

`RemovableCollection.dispose`

***

### update()

> **update**(`entity`, `recipe`): `any`

Defined in: [datastore/src/collections/CollectionBase.ts:327](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L327)

Applies a patch — or an updater function — to a row, returning the new value.

SPIKE (specs/immutable-updates.md). The immutable alternative to mutating a
change-tracked proxy. Two things make it different from `entity.price = 9`:

1. **It returns the new value; it does not modify the one you passed.**
2. **Your reference only has to identify the row, not be current.** The patch is
   applied to whatever the collection holds now, so handing it a stale entity is
   safe — which is the failure mode that actually loses data. It also makes
   read-modify-write correct, because the updater receives the current value:

```ts
// +2, as intended. With a stale `prev` captured by the caller this would be +1.
store.products.update(p, prev => ({ ...prev, price: prev.price + 1 }));
store.products.update(p, prev => ({ ...prev, price: prev.price + 1 }));
```

Arrays and Dates are values: a patch replaces them rather than merging into them.
That is deliberate — element-wise array merging makes "drop the last tag"
inexpressible, and it is the ambiguity that made in-place array mutation unreliable
under proxies (defect #12).

#### Parameters

##### entity

`InferType`\<`TEntity`\>

Any generation of the row. Only its id is read.

##### recipe

A partial entity to merge, or `current => next`.

`Record`\<`string`, `any`\> | (`current`) => `InferType`\<`TEntity`\>

#### Returns

`any`

#### Inherited from

`RemovableCollection.update`

***

### current()

> **current**(`entity`): `InferType`\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:337](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L337)

The current value of a row, given any generation of it.

The escape hatch for imperative code holding a reference across updates. Component
code should not need it — subscriptions hand out fresh values on every change.

#### Parameters

##### entity

`InferType`\<`TEntity`\>

#### Returns

`InferType`\<`TEntity`\>

#### Inherited from

`RemovableCollection.current`

***

### isCurrent()

> **isCurrent**(`entity`): `boolean`

Defined in: [datastore/src/collections/CollectionBase.ts:342](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L342)

Whether the given reference is the row's current value.

#### Parameters

##### entity

`InferType`\<`TEntity`\>

#### Returns

`boolean`

#### Inherited from

`RemovableCollection.isCurrent`

***

### hasChanges()

> **hasChanges**(): `boolean`

Defined in: [datastore/src/collections/CollectionBase.ts:357](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L357)

#### Returns

`boolean`

#### Inherited from

`RemovableCollection.hasChanges`

***

### instance()

> **instance**(...`entities`): `InferCreateType`\<`TEntity`\>[]

Defined in: [datastore/src/collections/CollectionBase.ts:366](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L366)

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

> **subscribe**(): `SubscribedQueryable`\<`TEntity`, `InferType`\<`TEntity`\>, () => `void`\>

Defined in: [datastore/src/collections/CollectionBase.ts:381](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L381)

Creates a subscription to the collection that will be notified of changes.

#### Returns

`SubscribedQueryable`\<`TEntity`, `InferType`\<`TEntity`\>, () => `void`\>

A subscription object that can be used to listen for collection changes

#### Inherited from

`RemovableCollection.subscribe`

***

### joinSide()

> **joinSide**(): [`JoinSide`](../type-aliases/JoinSide.md)\<`TEntity`\>

Defined in: [datastore/src/collections/CollectionBase.ts:399](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L399)

What this collection looks like as the INNER side of someone else's join.

Public because a join is written from the other collection — `players.join(matches, …)` —
and `matches` has to hand over three things it otherwise keeps to itself. Read
`JoinSide` for why each is needed; the short version is that the scoped options are the
ONLY place the inner side's soft-delete and `.scope()` filters exist once a join bypasses
its read path.

Views implement this by extending this class, which is a requirement rather than a
convenience: full-text search joins its index view to its source collection.

#### Returns

[`JoinSide`](../type-aliases/JoinSide.md)\<`TEntity`\>

#### Inherited from

`RemovableCollection.joinSide`

***

### join()

> **join**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`TEntity`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`InferType`\<`TEntity`\>, `InferType`\<`TInner`\>\>, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:420](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L420)

Pairs each row with every matching row of `inner` — an inner equi-join. See
`QueryableExecutor.setJoinQueryOption`.

```ts
store.players
    .join(s => s.playerMatches, p => p._id, m => m.playerId)
    .toArrayAsync();
```

`s` is this store, so a sibling collection is named once. Pass a collection directly to join
across two stores — see `JoinTarget`.

#### Type Parameters

##### TInner

`TInner` *extends* `object`

##### TKey

`TKey` *extends* `string` \| `number`

#### Parameters

##### inner

`JoinTarget`\<`TStore`, `TInner`\>

##### outerKey

(`outer`) => `TKey`

##### innerKey

(`inner`) => `TKey`

#### Returns

[`JoinQueryable`](JoinQueryable.md)\<`TEntity`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`InferType`\<`TEntity`\>, `InferType`\<`TInner`\>\>, `false`\>

#### Inherited from

`RemovableCollection.join`

***

### explain()

> **explain**(): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `true`\>

Defined in: [datastore/src/collections/CollectionBase.ts:437](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L437)

Reports where each query option ran — the database or memory — alongside the results.

See `QueryableAsync.explain`. Starts a query the same way `where` does, so the whole
collection can be explained without filtering it first.

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `true`\>

#### Inherited from

`RemovableCollection.explain`

***

### leftJoin()

> **leftJoin**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`TEntity`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`InferType`\<`TEntity`\>, `InferType`\<`TInner`\>\>, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:444](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L444)

Like `join`, but unmatched rows appear paired with `undefined`.

#### Type Parameters

##### TInner

`TInner` *extends* `object`

##### TKey

`TKey` *extends* `string` \| `number`

#### Parameters

##### inner

`JoinTarget`\<`TStore`, `TInner`\>

##### outerKey

(`outer`) => `TKey`

##### innerKey

(`inner`) => `TKey`

#### Returns

[`JoinQueryable`](JoinQueryable.md)\<`TEntity`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`InferType`\<`TEntity`\>, `InferType`\<`TInner`\>\>, `false`\>

#### Inherited from

`RemovableCollection.leftJoin`

***

### where()

#### Call Signature

> **where**(`expression`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`\>

Defined in: [datastore/src/collections/CollectionBase.ts:460](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L460)

Creates a query with a filter expression to filter entities in the collection.

##### Parameters

###### expression

`Filter`\<`InferType`\<`TEntity`\>\>

Filter expression to apply to the collection

##### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`\>

QueryableAsync instance for chaining additional query operations

##### Inherited from

`RemovableCollection.where`

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`\>

Defined in: [datastore/src/collections/CollectionBase.ts:467](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L467)

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

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`\>

QueryableAsync instance for chaining additional query operations

##### Inherited from

`RemovableCollection.where`

***

### sort()

> **sort**(`selector`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:485](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L485)

Sorts the collection by the specified property in ascending order.

#### Parameters

##### selector

`EntityMap`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\[keyof `InferType`\<`TEntity`\>\]\>

Function that selects the property to sort by

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.sort`

***

### sortDescending()

> **sortDescending**(`selector`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:496](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L496)

Sorts the collection by the specified property in descending order.

#### Parameters

##### selector

`EntityMap`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\[keyof `InferType`\<`TEntity`\>\]\>

Function that selects the property to sort by

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.sortDescending`

***

### nearest()

> **nearest**(`selector`, `vector`, `count`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:510](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L510)

The `count` entities whose vector is most similar to `vector`, nearest first.

#### Parameters

##### selector

`EntityMap`\<`InferType`\<`TEntity`\>, `InferType`\<`TEntity`\>\[keyof `InferType`\<`TEntity`\>\]\>

Function that selects the vector property to search

##### vector

`number`[]

The embedding to compare against, of the property's declared width

##### count

`number`

How many entities to return

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.nearest`

***

### toGroup()

> **toGroup**\<`R`\>(`selector`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:517](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L517)

#### Type Parameters

##### R

`R` *extends* `string` \| `number`

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `R`\>

##### done

`CallbackResult`\<`Record`\<`R`, `InferType`\<`TEntity`\>[]\>\>

#### Returns

`void`

#### Inherited from

`RemovableCollection.toGroup`

***

### toGroupAsync()

> **toGroupAsync**\<`R`\>(`selector`): `Promise`\<`Record`\<`R`, `InferType`\<`TEntity`\>[]\>\>

Defined in: [datastore/src/collections/CollectionBase.ts:523](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L523)

#### Type Parameters

##### R

`R` *extends* `string` \| `number`

#### Parameters

##### selector

`GenericFunction`\<`InferType`\<`TEntity`\>, `R`\>

#### Returns

`Promise`\<`Record`\<`R`, `InferType`\<`TEntity`\>[]\>\>

#### Inherited from

`RemovableCollection.toGroupAsync`

***

### map()

> **map**\<`R`\>(`expression`): `QueryableAsync`\<`TEntity`, `R`, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:532](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L532)

Maps the collection to a new shape using the specified transformation function.

#### Type Parameters

##### R

`R`

#### Parameters

##### expression

`EntityMap`\<`InferType`\<`TEntity`\>, `R`\>

Function that transforms each entity to the new shape

#### Returns

`QueryableAsync`\<`TEntity`, `R`, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.map`

***

### skip()

> **skip**(`amount`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:543](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L543)

Skips the specified number of entities in the collection.

#### Parameters

##### amount

`number`

Number of entities to skip

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.skip`

***

### take()

> **take**(`amount`): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:554](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L554)

Takes the specified number of entities from the collection.

#### Parameters

##### amount

`number`

Number of entities to take

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.take`

***

### toQueryable()

> **toQueryable**(): `QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:565](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L565)

Converts the collection to a QueryableAsync instance for building queries dynamically.
This is useful when you need to conditionally build queries by chaining operations based on logic.

#### Returns

`QueryableAsync`\<`TEntity`, `InferType`\<`TEntity`\>, `TStore`, `false`\>

QueryableAsync instance for chaining additional query operations

#### Inherited from

`RemovableCollection.toQueryable`

***

### apply()

> **apply**\<`U`, `Shape`\>(`composer`): `QueryableAsync`\<`TEntity`, `Shape`, `TStore`, `false`\>

Defined in: [datastore/src/collections/CollectionBase.ts:570](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L570)

#### Type Parameters

##### U

`U`

##### Shape

`Shape`

#### Parameters

##### composer

`QueryableBuilder`\<`TEntity`, `Shape`, `U`\>

#### Returns

`QueryableAsync`\<`TEntity`, `Shape`, `TStore`, `false`\>

#### Inherited from

`RemovableCollection.apply`

***

### toArray()

> **toArray**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:579](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L579)

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

Defined in: [datastore/src/collections/CollectionBase.ts:589](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L589)

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

Defined in: [datastore/src/collections/CollectionBase.ts:600](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L600)

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

Defined in: [datastore/src/collections/CollectionBase.ts:607](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L607)

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

Defined in: [datastore/src/collections/CollectionBase.ts:612](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L612)

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

Defined in: [datastore/src/collections/CollectionBase.ts:639](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L639)

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

Defined in: [datastore/src/collections/CollectionBase.ts:646](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L646)

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

Defined in: [datastore/src/collections/CollectionBase.ts:651](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L651)

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

Defined in: [datastore/src/collections/CollectionBase.ts:675](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L675)

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

Defined in: [datastore/src/collections/CollectionBase.ts:682](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L682)

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

Defined in: [datastore/src/collections/CollectionBase.ts:687](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L687)

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

Defined in: [datastore/src/collections/CollectionBase.ts:714](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L714)

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

Defined in: [datastore/src/collections/CollectionBase.ts:721](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L721)

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

Defined in: [datastore/src/collections/CollectionBase.ts:726](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L726)

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

Defined in: [datastore/src/collections/CollectionBase.ts:751](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L751)

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

Defined in: [datastore/src/collections/CollectionBase.ts:758](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L758)

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

Defined in: [datastore/src/collections/CollectionBase.ts:763](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L763)

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

Defined in: [datastore/src/collections/CollectionBase.ts:791](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L791)

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

Defined in: [datastore/src/collections/CollectionBase.ts:798](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L798)

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

Defined in: [datastore/src/collections/CollectionBase.ts:803](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L803)

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

Defined in: [datastore/src/collections/CollectionBase.ts:828](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L828)

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

> **every**(`expression`, `done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:835](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L835)

Checks if all entities match the parameterized filter.

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

Defined in: [datastore/src/collections/CollectionBase.ts:836](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L836)

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

Defined in: [datastore/src/collections/CollectionBase.ts:859](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L859)

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

> **everyAsync**(`expression`): `Promise`\<`boolean`\>

Defined in: [datastore/src/collections/CollectionBase.ts:866](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L866)

Checks if all entities match the parameterized filter asynchronously.

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

Defined in: [datastore/src/collections/CollectionBase.ts:867](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L867)

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

Defined in: [datastore/src/collections/CollectionBase.ts:888](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L888)

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

Defined in: [datastore/src/collections/CollectionBase.ts:901](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L901)

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

Defined in: [datastore/src/collections/CollectionBase.ts:914](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L914)

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

Defined in: [datastore/src/collections/CollectionBase.ts:927](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L927)

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

Defined in: [datastore/src/collections/CollectionBase.ts:940](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L940)

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

Defined in: [datastore/src/collections/CollectionBase.ts:953](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L953)

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

Defined in: [datastore/src/collections/CollectionBase.ts:965](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L965)

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

Defined in: [datastore/src/collections/CollectionBase.ts:977](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L977)

Counts the number of entities in the collection asynchronously.

#### Returns

`Promise`\<`number`\>

Promise that resolves with the count or rejects with an error

#### Inherited from

`RemovableCollection.countAsync`

***

### distinct()

> **distinct**(`done`): `void`

Defined in: [datastore/src/collections/CollectionBase.ts:989](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L989)

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

Defined in: [datastore/src/collections/CollectionBase.ts:1001](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/CollectionBase.ts#L1001)

Returns distinct entities from the collection asynchronously, removing duplicates.

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves with the distinct entities or rejects with an error

#### Inherited from

`RemovableCollection.distinctAsync`

***

### remove()

> **remove**(`entities`, `done`): `void`

Defined in: [datastore/src/collections/RemovableCollection.ts:26](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/RemovableCollection.ts#L26)

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

Defined in: [datastore/src/collections/RemovableCollection.ts:36](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/RemovableCollection.ts#L36)

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

Defined in: [datastore/src/collections/RemovableCollection.ts:46](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/RemovableCollection.ts#L46)

Removes all entities from the collection and persists the changes to the database.

#### Parameters

##### done

`CallbackResult`\<`InferType`\<`TEntity`\>[]\>

Callback function called when the operation completes or with an error

#### Returns

`void`

#### Inherited from

`RemovableCollection.removeAll`

***

### removeAllAsync()

> **removeAllAsync**(): `Promise`\<`InferType`\<`TEntity`\>[]\>

Defined in: [datastore/src/collections/RemovableCollection.ts:56](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/RemovableCollection.ts#L56)

Removes all entities from the collection asynchronously and returns a Promise.

#### Returns

`Promise`\<`InferType`\<`TEntity`\>[]\>

Promise that resolves when the operation completes or rejects with an error

#### Inherited from

`RemovableCollection.removeAllAsync`
