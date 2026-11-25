[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / FieldMergeOptions

# Type Alias: FieldMergeOptions\<T\>

> **FieldMergeOptions**\<`T`\> = `object`

Defined in: core/dist/plugins/conflicts.d.ts:42

## Type Parameters

### T

`T` *extends* `object`

## Properties

### onBoth()?

> `optional` **onBoth**: \<`K`\>(`field`, `values`) => `T`\[`K`\]

Defined in: core/dist/plugins/conflicts.d.ts:44

Picks the value of a field both sides changed. Defaults to the server's value.

#### Type Parameters

##### K

`K` *extends* `Extract`\<keyof `T`, `string`\>

#### Parameters

##### field

`K`

##### values

`FieldValues`\<`T`\[`K`\]\>

#### Returns

`T`\[`K`\]
