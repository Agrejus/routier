[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedExpression

# Type Alias: SerializedExpression

> **SerializedExpression** = \{ `t`: `"empty"`; \} \| \{ `t`: `"not-parsable"`; \} \| \{ `t`: `"operator"`; `operator`: [`Operator`](Operator.md); `left?`: `SerializedExpression`; `right?`: `SerializedExpression`; \} \| \{ `t`: `"comparator"`; `comparator`: [`Comparator`](Comparator.md); `negated`: `boolean`; `strict`: `boolean`; `left?`: `SerializedExpression`; `right?`: `SerializedExpression`; \} \| \{ `t`: `"property"`; `path`: `string`; `transformer`: [`Transformer`](Transformer.md) \| `null`; `locale`: `string` \| `null`; \} \| \{ `t`: `"value"`; `value`: [`SerializedValue`](SerializedValue.md); `transformer`: [`Transformer`](Transformer.md) \| `null`; `locale`: `string` \| `null`; \}

Defined in: [core/src/expressions/types.ts:17](https://github.com/Agrejus/routier/blob/main/core/src/expressions/types.ts#L17)

JSON-safe form of an expression tree. See `Expression.toJson`.
