[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / JsonTranslator

# Class: JsonTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/JsonTranslator.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/JsonTranslator.ts#L7)

## Extends

- [`DataTranslator`](/reference/api/core/src/classes/DataTranslator)\<`TRoot`, `TShape`\>

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

[`IQuery`](/reference/api/core/src/type-aliases/IQuery)\<`TRoot`, `TShape`\>

#### Returns

`JsonTranslator`\<`TRoot`, `TShape`\>

#### Inherited from

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`constructor`](/reference/api/core/src/classes/DataTranslator#constructor)

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

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`translate`](/reference/api/core/src/classes/DataTranslator#translate)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`filter`](/reference/api/core/src/classes/DataTranslator#filter)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`T`, `"map"`\>

#### Returns

`T`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`map`](/reference/api/core/src/classes/DataTranslator#map)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`count`](/reference/api/core/src/classes/DataTranslator#count)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`min`](/reference/api/core/src/classes/DataTranslator#min)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`max`](/reference/api/core/src/classes/DataTranslator#max)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"sort"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`sort`](/reference/api/core/src/classes/DataTranslator#sort)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`sum`](/reference/api/core/src/classes/DataTranslator#sum)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`distinct`](/reference/api/core/src/classes/DataTranslator#distinct)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"skip"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`skip`](/reference/api/core/src/classes/DataTranslator#skip)

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

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"take"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`take`](/reference/api/core/src/classes/DataTranslator#take)
