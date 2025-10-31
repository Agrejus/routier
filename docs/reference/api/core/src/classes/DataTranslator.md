[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DataTranslator

# Abstract Class: DataTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:4](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L4)

## Extended by

- [`JsonTranslator`](JsonTranslator.md)
- [`SqlTranslator`](SqlTranslator.md)

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new DataTranslator**\<`TRoot`, `TShape`\>(`query`): `DataTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L20)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

#### Returns

`DataTranslator`\<`TRoot`, `TShape`\>

## Methods

### count()

> `abstract` **count**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L25)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"count"`\>

#### Returns

`TResult`

***

### min()

> `abstract` **min**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L26)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

***

### max()

> `abstract` **max**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:27](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L27)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

***

### sum()

> `abstract` **sum**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:28](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L28)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

***

### distinct()

> `abstract` **distinct**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L29)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

***

### filter()

> `abstract` **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L32)

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

***

### skip()

> `abstract` **skip**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L33)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"skip"`\>

#### Returns

`TShape`

***

### take()

> `abstract` **take**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L34)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"take"`\>

#### Returns

`TShape`

***

### sort()

> `abstract` **sort**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:35](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L35)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sort"`\>

#### Returns

`TShape`

***

### map()

> `abstract` **map**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:36](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L36)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"map"`\>

#### Returns

`TShape`

***

### translate()

> **translate**(`data`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/translators/DataTranslator.ts#L38)

#### Parameters

##### data

`unknown`

#### Returns

`TShape`
