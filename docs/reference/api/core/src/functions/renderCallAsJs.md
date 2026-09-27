[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / renderCallAsJs

# Function: renderCallAsJs()

> **renderCallAsJs**(`call`, `renderOperand`, `renderArgs`): `string`

Defined in: [core/src/expressions/callSource.ts:87](https://github.com/Agrejus/routier/blob/main/core/src/expressions/callSource.ts#L87)

Thunked because rendering a side can record a parameter, and `regex-test` emits its argument
before its operand — so the two orders have to agree.

## Parameters

### call

[`Call`](../type-aliases/Call.md)

### renderOperand

() => `string`

### renderArgs

() => `string`[]

## Returns

`string`
