[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / propertyInfoToJsonSchema

# Function: propertyInfoToJsonSchema()

> **propertyInfoToJsonSchema**(`property`, `target`, `visited`, `useOutputType`): `Record`\<`string`, `unknown`\>

Defined in: [core/src/schema/utils/standardJsonSchema.ts:424](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/utils/standardJsonSchema.ts#L424)

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
