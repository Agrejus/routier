[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / peelCalls

# Function: peelCalls()

> **peelCalls**(`expression`): [`PeeledOperand`](../type-aliases/PeeledOperand.md)

Defined in: [core/src/expressions/utils.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/expressions/utils.ts#L18)

Separates an operand from the calls applied to it.

`null` when there is no operand beneath the calls. Every consumer needs this to decide whether a
comparator side is a property or a value, so it lives here rather than in each translator.

## Parameters

### expression

[`Expression`](../classes/Expression.md)

## Returns

[`PeeledOperand`](../type-aliases/PeeledOperand.md)
