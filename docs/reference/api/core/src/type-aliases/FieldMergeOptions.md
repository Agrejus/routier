[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / FieldMergeOptions

# Type Alias: FieldMergeOptions\<T\>

> **FieldMergeOptions**\<`T`\> = `object`

Defined in: [core/src/plugins/conflicts.ts:51](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L51)

## Type Parameters

### T

`T` *extends* `object`

## Properties

### onBoth()?

> `optional` **onBoth**: \<`K`\>(`field`, `values`) => `T`\[`K`\]

Defined in: [core/src/plugins/conflicts.ts:53](https://github.com/Agrejus/routier/blob/main/core/src/plugins/conflicts.ts#L53)

Picks the value of a field both sides changed. Defaults to the server's value.

#### Type Parameters

##### K

`K` *extends* `Extract`\<keyof `T`, `string`\>

#### Parameters

##### field

`K`

##### values

[`FieldValues`](FieldValues.md)\<`T`\[`K`\]\>

#### Returns

`T`\[`K`\]
