[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / HashFunction

# Type Alias: HashFunction()\<TEntity\>

> **HashFunction**\<`TEntity`\> = \{(`entity`, `type`): `string`; (`entity`, `type`): `string`; \}

Defined in: [core/src/schema/types.ts:50](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L50)

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
