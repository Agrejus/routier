[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedValue

# Type Alias: SerializedValue

> **SerializedValue** = \{ `k`: `"raw"`; `v`: `string` \| `number` \| `boolean` \| `null`; \} \| \{ `k`: `"date"`; `v`: `string`; \} \| \{ `k`: `"undefined"`; \} \| \{ `k`: `"number"`; `v`: `"NaN"` \| `"Infinity"` \| `"-Infinity"`; \} \| \{ `k`: `"array"`; `v`: `SerializedValue`[]; \}

Defined in: [core/src/expressions/types.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L9)

JSON-safe form of a literal. Tagged only where JSON cannot carry the value as it is.

See `Expression.toJson`.
