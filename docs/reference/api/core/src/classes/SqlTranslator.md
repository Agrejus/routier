[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SqlTranslator

# Class: SqlTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/SqlTranslator.ts:4](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L4)

## Extends

- [`DataTranslator`](/reference/api/core/src/classes/DataTranslator)\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new SqlTranslator**\<`TRoot`, `TShape`\>(`query`): `SqlTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L20)

#### Parameters

##### query

[`IQuery`](/reference/api/core/src/type-aliases/IQuery)\<`TRoot`, `TShape`\>

#### Returns

`SqlTranslator`\<`TRoot`, `TShape`\>

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

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L6)

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

Defined in: [core/src/plugins/translators/SqlTranslator.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L15)

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

Defined in: [core/src/plugins/translators/SqlTranslator.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L19)

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

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L23)

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

Defined in: [core/src/plugins/translators/SqlTranslator.ts:36](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L36)

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

### filter()

> **filter**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L40)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`filter`](/reference/api/core/src/classes/DataTranslator#filter)

***

### skip()

> **skip**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:44](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L44)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"skip"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`skip`](/reference/api/core/src/classes/DataTranslator#skip)

***

### take()

> **take**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:48](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L48)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"take"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`take`](/reference/api/core/src/classes/DataTranslator#take)

***

### sort()

> **sort**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:52](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L52)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"sort"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`sort`](/reference/api/core/src/classes/DataTranslator#sort)

***

### map()

> **map**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:56](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/SqlTranslator.ts#L56)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`TShape`, `"map"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](/reference/api/core/src/classes/DataTranslator).[`map`](/reference/api/core/src/classes/DataTranslator#map)
