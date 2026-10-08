[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / propertyInfoToJsonSchema

# Function: propertyInfoToJsonSchema()

> **propertyInfoToJsonSchema**(`property`, `target`, `visited`, `useOutputType`): `Record`\<`string`, `unknown`\>

Defined in: [core/src/schema/utils/standardJsonSchema.ts:429](https://github.com/Agrejus/routier/blob/main/core/src/schema/utils/standardJsonSchema.ts#L429)

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
