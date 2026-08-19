[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / rehydrateSchemaFromJsonSchema

# Function: rehydrateSchemaFromJsonSchema()

> **rehydrateSchemaFromJsonSchema**(`jsonSchema`, `collectionName?`): [`SchemaDefinition`](../classes/SchemaDefinition.md)\<`any`\>

Defined in: [core/src/schema/utils/standardJsonSchema.ts:576](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/utils/standardJsonSchema.ts#L576)

Rehydrates a JSON Schema back into a Routier SchemaDefinition.
This parses the JSON Schema structure and reconstructs the schema using Routier's builder API.

## Parameters

### jsonSchema

`Record`\<`string`, `unknown`\>

The JSON Schema object to rehydrate

### collectionName?

`string`

The collection name for the schema (if not in x-routier metadata)

## Returns

[`SchemaDefinition`](../classes/SchemaDefinition.md)\<`any`\>

A SchemaDefinition that can be compiled
