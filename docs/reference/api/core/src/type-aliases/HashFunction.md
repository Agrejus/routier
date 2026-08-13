[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / HashFunction

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

[`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`TEntity`\>

#### type

[`Object`](/reference/api/core/src/enumerations/HashType#object)

### Returns

`string`

## Call Signature

> (`entity`, `type`): `string`

### Parameters

#### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### type

[`Ids`](/reference/api/core/src/enumerations/HashType#ids)

### Returns

`string`
