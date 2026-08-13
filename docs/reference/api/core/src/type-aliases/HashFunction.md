[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / HashFunction

# Type Alias: HashFunction()\<TEntity\>

> **HashFunction**\<`TEntity`\> = \{(`entity`, `type`): `string`; (`entity`, `type`): `string`; \}

Defined in: [core/src/schema/types.ts:127](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L127)

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Call Signature

> (`entity`, `type`): `string`

### Parameters

#### entity

[`InferCreateType`](InferCreateType.md)\<`TEntity`\>

#### type

[`Object`](../enumerations/HashType.md#object)

### Returns

`string`

## Call Signature

> (`entity`, `type`): `string`

### Parameters

#### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### type

[`Ids`](../enumerations/HashType.md#ids)

### Returns

`string`
