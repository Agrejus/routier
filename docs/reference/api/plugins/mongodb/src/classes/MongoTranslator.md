[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoTranslator

# Class: MongoTranslator\<TRoot, TShape\>

Defined in: [plugins/mongodb/src/MongoTranslator.ts:13](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L13)

Skips the work the server already did.

`JsonTranslator` evaluates every query option in memory, which is what makes a plugin
correct before it is fast. Each override below is a claim that MongoDB applied that option
already — and the claim is conditional, because the plugin pushes an option down only when
it can do so without changing the answer.

The pattern, and the conditions, follow `DexieTranslator`.

## Extends

- `JsonTranslator`\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new MongoTranslator**\<`TRoot`, `TShape`\>(`query`): `MongoTranslator`\<`TRoot`, `TShape`\>

Defined in: [plugins/mongodb/src/MongoTranslator.ts:55](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L55)

#### Parameters

##### query

`IQuery`\<`TRoot`, `TShape`\>

#### Returns

`MongoTranslator`\<`TRoot`, `TShape`\>

#### Overrides

`JsonTranslator<TRoot, TShape>.constructor`

## Properties

### pushedDown

> `readonly` **pushedDown**: `object`

Defined in: [plugins/mongodb/src/MongoTranslator.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L16)

Set by the plugin for each option it actually sent to the server.

#### filter

> **filter**: `boolean` = `false`

#### sort

> **sort**: `boolean` = `false`

#### skip

> **skip**: `boolean` = `false`

#### take

> **take**: `boolean` = `false`

## Methods

### translate()

> **translate**(`data`): `ITranslatedValue`\<`TShape`\>

Defined in: core/dist/plugins/translators/DataTranslator.d.ts:47

#### Parameters

##### data

`unknown`

#### Returns

`ITranslatedValue`\<`TShape`\>

#### Inherited from

`JsonTranslator.translate`

***

### join()

> **join**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:21

The hash join itself, over rows already in memory — the floor every non-SQL backend
stands on.

Both halves are deserialized here, each with its own schema, because that is where the
`===` on key values is specified to happen: in entity shape, by the property names the
caller wrote in the key selectors. A `from`-renamed column reads correctly for free.

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"join"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.join`

***

### map()

> **map**\<`T`\>(`data`, `option`): `T`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:23

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`T`, `"map"`\>

#### Returns

`T`

#### Inherited from

`JsonTranslator.map`

***

### group()

> **group**\<`T`\>(`data`, `option`): `T`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:24

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`T`, `"group"`\>

#### Returns

`T`

#### Inherited from

`JsonTranslator.group`

***

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:25

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.count`

***

### min()

> **min**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:26

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.min`

***

### max()

> **max**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:27

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.max`

***

### nearest()

> **nearest**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:37

The similarity search itself, over values already in memory.

This is the floor the whole feature stands on: it is reached whenever the backend did
not do the search, which is every backend except the ones with a native vector index.
It reads the property through the option's selector, so it works on any shape the rows
arrive in.

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"nearest"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.nearest`

***

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:38

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.sum`

***

### distinct()

> **distinct**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/JsonTranslator.d.ts:39

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Inherited from

`JsonTranslator.distinct`

***

### filter()

> **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [plugins/mongodb/src/MongoTranslator.ts:23](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L23)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

`JsonTranslator.filter`

***

### sort()

> **sort**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [plugins/mongodb/src/MongoTranslator.ts:31](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L31)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"sort"`\>

#### Returns

`TResult`

#### Overrides

`JsonTranslator.sort`

***

### skip()

> **skip**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [plugins/mongodb/src/MongoTranslator.ts:39](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L39)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"skip"`\>

#### Returns

`TResult`

#### Overrides

`JsonTranslator.skip`

***

### take()

> **take**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [plugins/mongodb/src/MongoTranslator.ts:47](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/MongoTranslator.ts#L47)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"take"`\>

#### Returns

`TResult`

#### Overrides

`JsonTranslator.take`
