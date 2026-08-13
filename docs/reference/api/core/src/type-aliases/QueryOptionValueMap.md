[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / QueryOptionValueMap

# Type Alias: QueryOptionValueMap\<T\>

> **QueryOptionValueMap**\<`T`\> = `object`

Defined in: [core/src/plugins/query/types.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L30)

## Type Parameters

### T

`T` *extends* `object`

## Properties

### skip

> **skip**: `number`

Defined in: [core/src/plugins/query/types.ts:31](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L31)

***

### take

> **take**: `number`

Defined in: [core/src/plugins/query/types.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L32)

***

### sort

> **sort**: `object`

Defined in: [core/src/plugins/query/types.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L33)

#### selector

> **selector**: [`GenericFunction`](/reference/api/core/src/type-aliases/GenericFunction)\<`T`, `T`\[keyof `T`\]\>

#### direction

> **direction**: [`QueryOrdering`](/reference/api/core/src/enumerations/QueryOrdering)

#### propertyName

> **propertyName**: `string`

***

### map

> **map**: `object`

Defined in: [core/src/plugins/query/types.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L34)

#### selector

> **selector**: [`GenericFunction`](/reference/api/core/src/type-aliases/GenericFunction)\<`T`, `any`\>

#### fields

> **fields**: [`QueryField`](/reference/api/core/src/type-aliases/QueryField)[]

***

### filter

> **filter**: `object`

Defined in: [core/src/plugins/query/types.ts:35](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L35)

#### params?

> `optional` **params**: `object`

#### filter

> **filter**: [`ParamsFilter`](/reference/api/core/src/type-aliases/ParamsFilter)\<`T`, \{ \}\> \| [`Filter`](/reference/api/core/src/type-aliases/Filter)\<`T`\>

#### expression

> **expression**: [`Expression`](/reference/api/core/src/classes/Expression)

***

### min

> **min**: `true`

Defined in: [core/src/plugins/query/types.ts:36](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L36)

***

### max

> **max**: `true`

Defined in: [core/src/plugins/query/types.ts:37](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L37)

***

### count

> **count**: `true`

Defined in: [core/src/plugins/query/types.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L38)

***

### sum

> **sum**: `true`

Defined in: [core/src/plugins/query/types.ts:39](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L39)

***

### distinct

> **distinct**: `true`

Defined in: [core/src/plugins/query/types.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L40)
