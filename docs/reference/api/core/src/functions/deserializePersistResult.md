[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / deserializePersistResult

# Function: deserializePersistResult()

> **deserializePersistResult**(`response`, `resolveSchema`): [`BulkPersistResult`](../classes/BulkPersistResult.md)

Defined in: [core/src/plugins/wire/persist.ts:129](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/persist.ts#L129)

Rebuilds a save's echo against the SENDER's schema ids, which is what its change tracker holds.

## Parameters

### response

#### ok

`true`

#### kind

`"persist"`

#### changes

`object`[]

### resolveSchema

[`SchemaResolver`](../type-aliases/SchemaResolver.md)

## Returns

[`BulkPersistResult`](../classes/BulkPersistResult.md)
