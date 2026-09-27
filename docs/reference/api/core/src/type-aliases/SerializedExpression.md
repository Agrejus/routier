[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedExpression

# Type Alias: SerializedExpression

> **SerializedExpression** = \{ `type`: `"empty"`; \} \| \{ `type`: `"not-parsable"`; `reason?`: `string`; \} \| \{ `type`: `"operator"`; `operator`: [`Operator`](Operator.md); `left?`: `SerializedExpression`; `right?`: `SerializedExpression`; \} \| \{ `type`: `"comparator"`; `comparator`: [`Comparator`](Comparator.md); `negated`: `boolean`; `strict`: `boolean`; `left?`: `SerializedExpression`; `right?`: `SerializedExpression`; \} \| \{ `type`: `"call"`; `call`: [`Call`](Call.md); `expression`: `SerializedExpression`; `arguments`: `SerializedExpression`[]; \} \| \{ `type`: `"property"`; `path`: `string`; \} \| \{ `type`: `"value"`; `value`: [`SerializedValue`](SerializedValue.md); \}

Defined in: [core/src/expressions/types.ts:19](https://github.com/Agrejus/routier/blob/main/core/src/expressions/types.ts#L19)

JSON-safe form of an expression tree. See `Expression.toJson`.
