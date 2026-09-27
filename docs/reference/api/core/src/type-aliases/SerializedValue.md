[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedValue

# Type Alias: SerializedValue

> **SerializedValue** = `string` \| `number` \| `boolean` \| `null` \| `SerializedValue`[] \| \{ `date`: `string`; \} \| \{ `undefined`: `true`; \} \| \{ `number`: `"NaN"` \| `"Infinity"` \| `"-Infinity"`; \} \| \{ `regex`: \{ `source`: `string`; `flags`: `string`; \}; \} \| \{ `bigint`: `string`; \}

Defined in: [core/src/expressions/types.ts:9](https://github.com/Agrejus/routier/blob/main/core/src/expressions/types.ts#L9)

JSON-safe form of a literal. Tagged only where JSON cannot carry the value as it is.

See `Expression.toJson`.
