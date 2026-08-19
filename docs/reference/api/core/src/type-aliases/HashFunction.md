[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / HashFunction

# Type Alias: HashFunction()\<TEntity\>

> **HashFunction**\<`TEntity`\> = \{(`entity`, `type`): `string`; (`entity`, `type`): `string`; \}

Defined in: [core/src/schema/types.ts:127](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L127)

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
