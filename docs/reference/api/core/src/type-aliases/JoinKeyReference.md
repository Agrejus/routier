[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JoinKeyReference

# Type Alias: JoinKeyReference

> **JoinKeyReference** = `object`

Defined in: [core/src/plugins/query/join.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L21)

One side's join key, as a property path plus the resolved property.

The path is what survives serialization; the `PropertyInfo` is the live handle that reads
the value and resolves a `from`-renamed storage name. Both, because a key read has to work
on either side of the wire.

## Properties

### propertyName

> **propertyName**: `string`

Defined in: [core/src/plugins/query/join.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L22)

***

### property

> **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\> \| `null`

Defined in: [core/src/plugins/query/join.ts:23](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L23)
