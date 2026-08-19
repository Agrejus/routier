[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / deserializeBulkPersist

# Function: deserializeBulkPersist()

> **deserializeBulkPersist**(`request`, `resolveSchema`): `object`

Defined in: [core/src/plugins/wire/persist.ts:63](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/persist.ts#L63)

Rebuilds a change set from its wire form, keyed by the RECEIVER's schema ids.

## Parameters

### request

[`SerializedPersistRequest`](../type-aliases/SerializedPersistRequest.md)

### resolveSchema

[`SchemaResolver`](../type-aliases/SchemaResolver.md)

## Returns

`object`

### changes

> **changes**: [`BulkPersistChanges`](../classes/BulkPersistChanges.md)

### schemas

> **schemas**: [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>[]

## Throws

when a named collection is not one this store declares. A save aimed at data this side
does not have must not be silently dropped — the caller would be told it succeeded.
