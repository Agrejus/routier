[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / fastHash

# Function: fastHash()

> **fastHash**(`value`, `seed`): `number`

Defined in: [core/src/utilities/strings.ts:35](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/utilities/strings.ts#L35)

Fast string hash optimized for comparisons.
Uses djb2 algorithm - very fast and good distribution for short to medium strings.
Same input always produces same output (deterministic).

## Parameters

### value

`string`

The string to hash

### seed

`number` = `5381`

Optional seed value (default: 5381)

## Returns

`number`

A positive 32-bit integer hash value

## Example

```ts
fastHash("test") === fastHash("test") // true
fastHash("test") !== fastHash("test2") // true
```
