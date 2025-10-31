[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JsonTranslator

# Class: JsonTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/JsonTranslator.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L7)

## Extends

- [`DataTranslator`](DataTranslator.md)\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new JsonTranslator**\<`TRoot`, `TShape`\>(`query`): `JsonTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L20)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

#### Returns

`JsonTranslator`\<`TRoot`, `TShape`\>

#### Inherited from

[`DataTranslator`](DataTranslator.md).[`constructor`](DataTranslator.md#constructor)

## Methods

### translate()

> **translate**(`data`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L38)

#### Parameters

##### data

`unknown`

#### Returns

`TShape`

#### Inherited from

[`DataTranslator`](DataTranslator.md).[`translate`](DataTranslator.md#translate)

***

### filter()

> **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L9)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`filter`](DataTranslator.md#filter)

***

### map()

> **map**\<`T`\>(`data`, `option`): `T`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:28](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L28)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `"map"`\>

#### Returns

`T`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`map`](DataTranslator.md#map)

***

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:59](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L59)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`count`](DataTranslator.md#count)

***

### min()

> **min**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:68](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L68)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`min`](DataTranslator.md#min)

***

### max()

> **max**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:72](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L72)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`max`](DataTranslator.md#max)

***

### sort()

> **sort**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:76](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L76)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sort"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sort`](DataTranslator.md#sort)

***

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:92](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L92)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sum`](DataTranslator.md#sum)

***

### distinct()

> **distinct**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:118](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L118)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`distinct`](DataTranslator.md#distinct)

***

### skip()

> **skip**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:150](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L150)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"skip"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`skip`](DataTranslator.md#skip)

***

### take()

> **take**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/JsonTranslator.ts:170](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L170)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"take"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`take`](DataTranslator.md#take)
