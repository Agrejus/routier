[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedUpdate

# Type Alias: SerializedUpdate

> **SerializedUpdate** = `object`

Defined in: [core/src/plugins/wire/types.ts:62](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L62)

One entity update, as `EntityUpdateInfo` minus nothing — every field of it is already JSON.

## Properties

### entity

> **entity**: `unknown`

Defined in: [core/src/plugins/wire/types.ts:63](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L63)

***

### changeType

> **changeType**: `"propertiesChanged"` \| `"markedDirty"` \| `"notModified"`

Defined in: [core/src/plugins/wire/types.ts:64](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L64)

***

### delta

> **delta**: `unknown`

Defined in: [core/src/plugins/wire/types.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L65)

***

### concurrency?

> `optional` **concurrency**: `object`

Defined in: [core/src/plugins/wire/types.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L66)

#### column

> **column**: `string`

#### expected

> **expected**: `number`
