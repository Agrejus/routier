[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / redactEntity

# Function: redactEntity()

> **redactEntity**\<`TEntity`, `TValue`\>(`schema`, `row`): [`UnknownRecord`](../type-aliases/UnknownRecord.md) \| `TValue`

Defined in: [core/src/schema/utils/redactEntity.ts:27](https://github.com/Agrejus/routier/blob/main/core/src/schema/utils/redactEntity.ts#L27)

A copy of `row` with the value of every sensitive property replaced by `REDACTED`, for
Routier's own logs. The row itself is not changed, and a row with nothing sensitive in it is
returned as it is.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

### TValue

`TValue`

## Parameters

### schema

#### sensitiveProperties

readonly [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

### row

`TValue`

## Returns

[`UnknownRecord`](../type-aliases/UnknownRecord.md) \| `TValue`
