[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryOptionsCollection

# Class: QueryOptionsCollection\<T\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:83](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L83)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:104](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L104)

##### Returns

`Map`\<keyof [`QueryOptionValueMap`](../type-aliases/QueryOptionValueMap.md)\<`unknown`\>, [`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>[]\>

***

### isEmpty

#### Get Signature

> **get** **isEmpty**(): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:108](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L108)

##### Returns

`boolean`

## Methods

### EMPTY()

> `static` **EMPTY**\<`R`\>(): `QueryOptionsCollection`\<`R`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:112](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L112)

#### Type Parameters

##### R

`R`

#### Returns

`QueryOptionsCollection`\<`R`\>

***

### isEmpty()

> `static` **isEmpty**\<`T`\>(`options`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:116](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L116)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:120](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L120)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:266](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L266)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:303](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L303)

Captures the collection's current state and returns a function that restores it.

Terminal queryable operations (count, first, aggregates, …) record their option on
the shared collection before executing. Without restoring, a re-executed terminal —
the whole point of a subscribed queryable — stacks its option a second time and
runs it over the first execution's scalar result.

The item objects are shared with the snapshot. Nothing reports on them, because every
dispatch sends a `forDispatch` copy, so a restore brings back no reports.

#### Returns

> (): `void`

##### Returns

`void`

***

### reportMissingCapability()

> **reportMissingCapability**(`item`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:349](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L349)

A plugin reporting that its engine cannot express one option.

Core marks the rest of the database phase `not-reached`, because the database has to stop
there — a window applied in front of a filter that was not applied returns the wrong rows.
Passing the cascade through core is what makes it impossible for a plugin to mark a
non-contiguous cut.

A report names a culprit and never un-names one, so reports commute.

The option is not moved to the memory arm. It stays where it was planned, which is what keeps
a redirect distinguishable from something core sent to memory in the first place.

#### Parameters

##### item

[`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>

#### Returns

`void`

***

### reportEngineDivergence()

> **reportEngineDivergence**(`item`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:359](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L359)

A plugin reporting that its engine would answer one option differently from JavaScript.

Same cascade as `reportMissingCapability`, and a separate reason because the caller can act on
one and not the other. See `DatabaseExecutionReason`.

#### Parameters

##### item

[`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>

#### Returns

`void`

***

### forDispatch()

> **forDispatch**(): `QueryOptionsCollection`\<`T`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:406](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L406)

A copy of the collection for one dispatch to a plugin, with nothing reported on it.

Capability is answered per dispatch, so a report is only an answer for the execution that
produced it. Reports are written onto items, and the items of a queryable's collection
outlive any one execution: a snapshot shares them, and a subscription dispatches the same
query on every change. A report left on them replays options the plugin did run on the
next execution, such as a `skip` applied twice over rows already windowed, or hands a
renamed filter to memory that the engine could have run.

Each item keeps its index, name, value and target. A half from `split`/`splitAt` is copied
with a copy of its origin, and its items are that copy's items, so a report on the half still
cascades over the whole dispatch without reaching the collection it was copied from.

#### Returns

`QueryOptionsCollection`\<`T`\>

***

### notExecuted()

> **notExecuted**(): [`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>[]

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:453](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L453)

The options the database did not run, in the order they were written.

#### Returns

[`QueryCollectionItem`](../type-aliases/QueryCollectionItem.md)\<`any`, `any`\>[]

***

### split()

> **split**(): `object`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:460](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L460)

#### Returns

`object`

##### memory

> **memory**: `QueryOptionsCollection`\<`T`\>

##### database

> **database**: `QueryOptionsCollection`\<`T`\>

***

### hasTransformations()

> **hasTransformations**(): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:489](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L489)

#### Returns

`boolean`

***

### has()

> **has**\<`K`\>(`name`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:494](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L494)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:498](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L498)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:502](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L502)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:516](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L516)

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

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:548](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/QueryOptionsCollection.ts#L548)

#### Parameters

##### iterator

(`item`) => `void`

#### Returns

`void`
