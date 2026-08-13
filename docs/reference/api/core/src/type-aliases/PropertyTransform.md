[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PropertyTransform

# Type Alias: PropertyTransform\<T\>

> **PropertyTransform**\<`T`\> = `object`

Defined in: [core/src/schema/types.ts:282](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L282)

A two-way transform between the application value and the stored value.

Both directions may be async. Held as a live reference rather than stringified, so a
closure works and `injected` is a convenience rather than the only way in.

## Type Parameters

### T

`T` *extends* `any`

## Properties

### to()

> **to**: (`value`, `entity`) => `unknown` \| `Promise`\<`unknown`\>

Defined in: [core/src/schema/types.ts:289](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L289)

Application value to stored value. Runs before the plugin sees it. May be async.

`entity` is there for the one-way case: a transform with no `from` derives a value
rather than converting one, which is what `computed` does.

#### Parameters

##### value

`T`

##### entity

`Record`\<`string`, `unknown`\>

#### Returns

`unknown` \| `Promise`\<`unknown`\>

***

### from()?

> `optional` **from**: (`value`) => `T` \| `Promise`\<`T`\>

Defined in: [core/src/schema/types.ts:296](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L296)

Stored value back to application value. Runs after the plugin returns it.

Optional. Leave it out and the transform is one-way: the stored value is the value.

#### Parameters

##### value

`unknown`

#### Returns

`T` \| `Promise`\<`T`\>

***

### stores?

> `optional` **stores**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/types.ts:305](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L305)

What the column becomes, when the stored form is not the property's own type.

Defaults to the property's own type, so nothing changes unless you say it does. A
library that always produces text — a cipher, a compressor — sets this once, and the
caller who uses that library never writes it.

***

### comparable?

> `optional` **comparable**: `"equality"` \| `"none"`

Defined in: [core/src/schema/types.ts:313](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L313)

Whether a filter on this property can still run in the database.

Defaults to `none`, which rejects the filter rather than returning wrong rows. Set
`equality` only when `to` is deterministic.
