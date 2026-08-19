[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / deserializePersistResult

# Function: deserializePersistResult()

> **deserializePersistResult**(`response`, `resolveSchema`): [`BulkPersistResult`](../classes/BulkPersistResult.md)

Defined in: [core/src/plugins/wire/persist.ts:129](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/persist.ts#L129)

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
