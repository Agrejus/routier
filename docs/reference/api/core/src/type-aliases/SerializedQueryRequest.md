[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedQueryRequest

# Type Alias: SerializedQueryRequest

> **SerializedQueryRequest** = `object`

Defined in: [core/src/plugins/wire/types.ts:57](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/types.ts#L57)

## Properties

### kind

> **kind**: `"query"`

Defined in: [core/src/plugins/wire/types.ts:58](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/types.ts#L58)

***

### collectionName

> **collectionName**: `string`

Defined in: [core/src/plugins/wire/types.ts:59](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/types.ts#L59)

***

### options

> **options**: [`SerializedQueryOption`](SerializedQueryOption.md)[]

Defined in: [core/src/plugins/wire/types.ts:60](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/types.ts#L60)

***

### explain

> **explain**: `boolean`

Defined in: [core/src/plugins/wire/types.ts:66](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/types.ts#L66)

Whether the caller wants the response to say what the server ran. Required — a query is
either explained or it is not. A server whose plugin does not report answers `true` the
same as `false`, and the caller's explanation marks the remote step as not reported.
