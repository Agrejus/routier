[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / distinctJoinKeys

# Function: distinctJoinKeys()

> **distinctJoinKeys**(`rows`, `reference`, `threshold`, `options?`): `Set`\<`unknown`\>

Defined in: [core/src/plugins/query/join.ts:249](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/join.ts#L249)

The distinct join keys of the outer rows, or `null` when there are too many to be worth sending.

`null` means "do not prefilter", not "no keys" — an empty SET is a real answer meaning the inner
side cannot match anything.

## Parameters

### rows

readonly [`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

### reference

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

### threshold

`number` = `DEFAULT_SEMI_JOIN_KEY_THRESHOLD`

### options?

#### storageShape?

`boolean`

## Returns

`Set`\<`unknown`\>
