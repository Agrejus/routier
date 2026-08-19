[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JoinKeyReference

# Type Alias: JoinKeyReference

> **JoinKeyReference** = `object`

Defined in: [core/src/plugins/query/join.ts:21](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L21)

One side's join key, as a property path plus the resolved property.

The path is what survives serialization; the `PropertyInfo` is the live handle that reads
the value and resolves a `from`-renamed storage name. Both, because a key read has to work
on either side of the wire.

## Properties

### propertyName

> **propertyName**: `string`

Defined in: [core/src/plugins/query/join.ts:22](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L22)

***

### property

> **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\> \| `null`

Defined in: [core/src/plugins/query/join.ts:23](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L23)
