[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedUpdate

# Type Alias: SerializedUpdate

> **SerializedUpdate** = `object`

Defined in: [core/src/plugins/wire/types.ts:69](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L69)

One entity update, as `EntityUpdateInfo` minus nothing — every field of it is already JSON.

## Properties

### entity

> **entity**: `unknown`

Defined in: [core/src/plugins/wire/types.ts:70](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L70)

***

### changeType

> **changeType**: `"propertiesChanged"` \| `"markedDirty"` \| `"notModified"`

Defined in: [core/src/plugins/wire/types.ts:71](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L71)

***

### delta

> **delta**: `unknown`

Defined in: [core/src/plugins/wire/types.ts:72](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L72)

***

### concurrency?

> `optional` **concurrency**: `object`

Defined in: [core/src/plugins/wire/types.ts:73](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L73)

#### column

> **column**: `string`

#### expected

> **expected**: `number`
