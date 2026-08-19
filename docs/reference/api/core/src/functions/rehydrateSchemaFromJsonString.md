[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / rehydrateSchemaFromJsonString

# Function: rehydrateSchemaFromJsonString()

> **rehydrateSchemaFromJsonString**(`jsonString`, `collectionName?`): [`SchemaDefinition`](../classes/SchemaDefinition.md)\<`any`\>

Defined in: [core/src/schema/utils/standardJsonSchema.ts:553](https://github.com/Agrejus/routier/blob/main/core/src/schema/utils/standardJsonSchema.ts#L553)

Parses a JSON string containing a JSON Schema and rehydrates it into a Routier SchemaDefinition.
This is a convenience wrapper around `rehydrateSchemaFromJsonSchema` that handles JSON parsing.

## Parameters

### jsonString

`string`

The JSON string containing the JSON Schema

### collectionName?

`string`

The collection name for the schema (if not in x-routier metadata)

## Returns

[`SchemaDefinition`](../classes/SchemaDefinition.md)\<`any`\>

A SchemaDefinition that can be compiled

## Throws

Error if the JSON string is invalid or doesn't contain a valid JSON Schema
