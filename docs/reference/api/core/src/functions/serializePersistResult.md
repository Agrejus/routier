[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / serializePersistResult

# Function: serializePersistResult()

> **serializePersistResult**(`result`, `schemas`): [`SerializedResponse`](../type-aliases/SerializedResponse.md)

Defined in: [core/src/plugins/wire/persist.ts:103](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/persist.ts#L103)

Serializes the ECHO of a save — the part the change tracker cannot do without.

A save's result is not a receipt. It carries the rows as the database wrote them, including any
identity the database assigned, and the change tracker matches each one back to the addition that
produced it. Returning a count instead would leave every inserted entity without its key.

## Parameters

### result

[`BulkPersistResult`](../classes/BulkPersistResult.md)

### schemas

[`ReadonlySchemaCollection`](../classes/ReadonlySchemaCollection.md)

## Returns

[`SerializedResponse`](../type-aliases/SerializedResponse.md)
