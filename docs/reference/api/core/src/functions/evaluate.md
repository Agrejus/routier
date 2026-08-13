[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / evaluate

# Function: evaluate()

> **evaluate**(`expression`, `row`): [`EvaluationResult`](../type-aliases/EvaluationResult.md)

Defined in: [core/src/expressions/evaluate.ts:160](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/evaluate.ts#L160)

Evaluates `expression` against `row`, or returns `undefined` when it cannot.

See the note at the top of this file: `undefined` means KEEP the row.

## Parameters

### expression

[`Expression`](../classes/Expression.md)

### row

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

## Returns

[`EvaluationResult`](../type-aliases/EvaluationResult.md)
