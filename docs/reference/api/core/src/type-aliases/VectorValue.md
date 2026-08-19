[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / VectorValue

# Type Alias: VectorValue

> **VectorValue** = `number`[]

Defined in: [core/src/schema/types.ts:88](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L88)

What a vector property holds, in and out: a plain list of numbers.

Named rather than written inline because the inference rules have to recognise it after a
modifier has erased which class produced it — the same problem `FileReferenceValue` solves
above, and for the same reason.
