[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / getStorageDateReviver

# Function: getStorageDateReviver()

> **getStorageDateReviver**(`schema`): [`StorageDateReviver`](../type-aliases/StorageDateReviver.md)

Defined in: [core/src/schema/utils/storageDates.ts:101](https://github.com/Agrejus/routier/blob/main/core/src/schema/utils/storageDates.ts#L101)

The reviver for `schema`'s records, or `null` when it declares no dates.

Built once per compiled schema. A read revives every row it returns, so the paths are resolved
here rather than per row.

## Parameters

### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

## Returns

[`StorageDateReviver`](../type-aliases/StorageDateReviver.md)
