[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / propertyInfoToJsonSchema

# Function: propertyInfoToJsonSchema()

> **propertyInfoToJsonSchema**(`property`, `target`, `visited`, `useOutputType`): `Record`\<`string`, `unknown`\>

Defined in: [core/src/schema/utils/standardJsonSchema.ts:424](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/utils/standardJsonSchema.ts#L424)

Converts a Routier PropertyInfo to a JSON Schema property definition.

## Parameters

### property

[`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\>

### target

[`Target`](../namespaces/StandardJSONSchemaV1/type-aliases/Target.md)

### visited

`Set`\<`string`\> = `...`

### useOutputType

`boolean` = `false`

## Returns

`Record`\<`string`, `unknown`\>
