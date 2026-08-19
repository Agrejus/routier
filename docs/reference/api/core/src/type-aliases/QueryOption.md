[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryOption

# Type Alias: QueryOption\<T, K\>

> **QueryOption**\<`T`, `K`\> = `object`

Defined in: [core/src/plugins/query/types.ts:43](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L43)

## Type Parameters

### T

`T`

### K

`K` *extends* [`QueryOptionName`](QueryOptionName.md)

## Properties

### name

> **name**: [`QueryOptionName`](QueryOptionName.md)

Defined in: [core/src/plugins/query/types.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L44)

***

### value

> **value**: [`QueryOptionValueMap`](QueryOptionValueMap.md)\<`T`\>\[`K`\]

Defined in: [core/src/plugins/query/types.ts:45](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L45)

***

### target

> **target**: [`QueryOptionExecutionTarget`](QueryOptionExecutionTarget.md)

Defined in: [core/src/plugins/query/types.ts:46](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L46)

***

### reason?

> `optional` **reason**: [`MemoryExecutionReason`](MemoryExecutionReason.md)

Defined in: [core/src/plugins/query/types.ts:48](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L48)

Set only when `target` is `"memory"`.
