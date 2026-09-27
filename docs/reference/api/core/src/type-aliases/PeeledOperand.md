[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PeeledOperand

# Type Alias: PeeledOperand

> **PeeledOperand** = `object`

Defined in: [core/src/expressions/utils.ts:10](https://github.com/Agrejus/routier/blob/main/core/src/expressions/utils.ts#L10)

An operand with the calls wrapping it, innermost first — the order they are applied in.

The nodes rather than their names: a binary call carries arguments, and a consumer that only knows
the name renders `LOWER(col)` correctly and `col + ?` not at all.

## Properties

### operand

> **operand**: [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/utils.ts:10](https://github.com/Agrejus/routier/blob/main/core/src/expressions/utils.ts#L10)

***

### calls

> **calls**: [`CallExpression`](../classes/CallExpression.md)[]

Defined in: [core/src/expressions/utils.ts:10](https://github.com/Agrejus/routier/blob/main/core/src/expressions/utils.ts#L10)
