[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / extractTypeInfo

# Function: extractTypeInfo()

> **extractTypeInfo**\<`T`\>(`compiledSchema`): `object`

Defined in: [core/src/schema/utils/standardJsonSchema.ts:829](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/utils/standardJsonSchema.ts#L829)

Attempts to extract type information from a compiled schema for better type inference.

Note: TypeScript types are compile-time only, so we can't extract actual type information at runtime.
The Standard JSON Schema spec allows libraries to advertise their inferred types via the `types` property,
but this requires compile-time type information that isn't available at runtime.

For proper type inference, consumers should use TypeScript's type system:
```typescript
const schema = s.define("users", { ... }).compile();
type User = InferType<typeof schema>;
type CreateUser = InferCreateType<typeof schema>;
```

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### compiledSchema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

The compiled schema to extract type info from

## Returns

`object`

A description of the type names (for documentation purposes only)

### inputType

> **inputType**: `string`

### outputType

> **outputType**: `string`
