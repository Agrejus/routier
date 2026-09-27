[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / StorageDateReviver

# Type Alias: StorageDateReviver()

> **StorageDateReviver** = (`record`) => `void`

Defined in: [core/src/schema/utils/storageDates.ts:21](https://github.com/Agrejus/routier/blob/main/core/src/schema/utils/storageDates.ts#L21)

Turns the dates on a STORAGE-shape record back into Dates, in place.

The datastore serializes a Date to an ISO string, and a store that persists JSON hands the
string back. A plugin that runs the caller's lambdas over its own records has to undo that
first: a string is never greater than a Date and has no `getTime()`. It is the one thing JSON
changed, so it is the one thing undone. Keys stay under their `from` names, because the
datastore deserializes the rows the plugin returns, by those names.

Not the full `schema.deserialize`, which also moves every key to its in-memory name: rows
deserialized twice lose every renamed property.

Only a string is converted, so a Date the store kept as a Date is left alone, and so is a
record that was already revived. The datastore's own deserialize does the same, so a revived
record deserializes to the same entity.

## Parameters

### record

`Record`\<`string`, `unknown`\>

## Returns

`void`
