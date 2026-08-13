[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RequestInfo

# Type Alias: RequestInfo\<TContext\>

> **RequestInfo**\<`TContext`\> = `object`

Defined in: [core/src/plugins/wire/handler.ts:63](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L63)

What a hook is told about the request it is judging.

## Type Parameters

### TContext

`TContext`

## Properties

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/wire/handler.ts:64](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L64)

***

### collectionNames

> **collectionNames**: `string`[]

Defined in: [core/src/plugins/wire/handler.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L66)

Every collection this request touches, including the inner side of any join.

***

### context

> **context**: `TContext`

Defined in: [core/src/plugins/wire/handler.ts:68](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L68)

Whatever the transport built from the request — a user, a tenant, a token. Never the body.

***

### request

> **request**: [`SerializedRequest`](SerializedRequest.md)

Defined in: [core/src/plugins/wire/handler.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L70)

The raw request, for a policy that needs to look closer. Treat it as caller-controlled input.
