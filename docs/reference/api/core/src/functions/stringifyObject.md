[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / stringifyObject

# Function: stringifyObject()

> **stringifyObject**(`obj`, `maxDepth`, `currentDepth`): `string`

Defined in: [core/src/utilities/strings.ts:60](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/utilities/strings.ts#L60)

Converts any value to a readable string representation.
Handles primitives, objects, arrays, classes, dates, errors, and functions.
Supports depth limiting to prevent infinite recursion on circular references.

## Parameters

### obj

`unknown`

The value to stringify

### maxDepth

`number` = `3`

Maximum depth for nested objects (default: 3)

### currentDepth

`number` = `0`

Current recursion depth (default: 0)

## Returns

`string`

String representation of the value

## Example

```ts
stringifyObject({ name: "test", count: 5 }) // '{ name: "test", count: 5 }'
stringifyObject([1, 2, 3]) // '[1, 2, 3]'
stringifyObject(new Date()) // 'Date(2024-01-01T00:00:00.000Z)'
```
