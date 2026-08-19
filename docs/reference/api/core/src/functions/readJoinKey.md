[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / readJoinKey

# Function: readJoinKey()

> **readJoinKey**(`row`, `reference`): `unknown`

Defined in: [core/src/plugins/query/join.ts:88](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/join.ts#L88)

Reads a join key off an entity-shape row.

Through the `PropertyInfo` when there is one, so a nested path (`a.b.id`) resolves the same
way every other option resolves it. The string fallback exists for an option that crossed a
wire without its schema; it walks the same path by name.

## Parameters

### row

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

### reference

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

## Returns

`unknown`
