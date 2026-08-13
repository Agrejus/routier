[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryOptionsCollection

# Class: QueryOptionsCollection\<T\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:7](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L7)

## Type Parameters

### T

`T`

## Constructors

### Constructor

> **new QueryOptionsCollection**\<`T`\>(): `QueryOptionsCollection`\<`T`\>

#### Returns

`QueryOptionsCollection`\<`T`\>

## Accessors

### items

#### Get Signature

> **get** **items**(): `Map`\<keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>, [`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>[]\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L14)

##### Returns

`Map`\<keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>, [`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>[]\>

***

### isEmpty

#### Get Signature

> **get** **isEmpty**(): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L18)

##### Returns

`boolean`

## Methods

### EMPTY()

> `static` **EMPTY**\<`R`\>(): `QueryOptionsCollection`\<`R`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L22)

#### Type Parameters

##### R

`R`

#### Returns

`QueryOptionsCollection`\<`R`\>

***

### isEmpty()

> `static` **isEmpty**\<`T`\>(`options`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L26)

#### Type Parameters

##### T

`T`

#### Parameters

##### options

`QueryOptionsCollection`\<`T`\>

#### Returns

`boolean`

***

### add()

> **add**\<`K`\>(`name`, `value`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L30)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

##### value

[`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`T`\>\[`K`\]

#### Returns

`void`

***

### splitAt()

> **splitAt**\<`K`\>(`name`): `object`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:170](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L170)

Splits the collection around the FIRST occurrence of `name`, preserving order.

For a join: the options recorded before it operate on entity rows, the option itself
produces tuples, and the ones after it operate on tuples. Three different shapes, so the
caller has to run them in three steps rather than one pass.

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

`object`

##### before

> **before**: `QueryOptionsCollection`\<`T`\>

##### at

> **at**: [`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `K`\>

##### after

> **after**: `QueryOptionsCollection`\<`T`\>

***

### snapshot()

> **snapshot**(): () => `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:201](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L201)

Captures the collection's current state and returns a function that restores it.

Terminal queryable operations (count, first, aggregates, …) record their option on
the shared collection before executing. Without restoring, a re-executed terminal —
the whole point of a subscribed queryable — stacks its option a second time and
runs it over the first execution's scalar result.

#### Returns

> (): `void`

##### Returns

`void`

***

### split()

> **split**(): `object`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:214](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L214)

#### Returns

`object`

##### memory

> **memory**: `QueryOptionsCollection`\<`T`\>

##### database

> **database**: `QueryOptionsCollection`\<`T`\>

***

### hasTransformations()

> **hasTransformations**(): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:238](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L238)

#### Returns

`boolean`

***

### has()

> **has**\<`K`\>(`name`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:243](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L243)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

`boolean`

***

### get()

> **get**\<`K`\>(`name`): [`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`T`, `K`\>[]

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:247](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L247)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`T`, `K`\>[]

***

### getLast()

> **getLast**\<`K`\>(`name`): [`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `K`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:251](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L251)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `K`\>

***

### getValues()

> **getValues**\<`K`\>(`name`): [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`T`\>\[`K`\][]

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:265](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L265)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`T`\>\[`K`\][]

***

### forEach()

> **forEach**(`iterator`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:286](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/QueryOptionsCollection.ts#L286)

#### Parameters

##### iterator

(`item`) => `void`

#### Returns

`void`
