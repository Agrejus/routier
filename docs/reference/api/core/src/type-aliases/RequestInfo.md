[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RequestInfo

# Type Alias: RequestInfo\<TContext\>

> **RequestInfo**\<`TContext`\> = `object`

Defined in: [core/src/plugins/wire/handler.ts:64](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L64)

What a hook is told about the request it is judging.

## Type Parameters

### TContext

`TContext`

## Properties

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/wire/handler.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L65)

***

### collectionNames

> **collectionNames**: `string`[]

Defined in: [core/src/plugins/wire/handler.ts:67](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L67)

Every collection this request touches, including the inner side of any join.

***

### context

> **context**: `TContext`

Defined in: [core/src/plugins/wire/handler.ts:69](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L69)

Whatever the transport built from the request — a user, a tenant, a token. Never the body.

***

### request

> **request**: [`SerializedRequest`](SerializedRequest.md)

Defined in: [core/src/plugins/wire/handler.ts:71](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L71)

The raw request, for a policy that needs to look closer. Treat it as caller-controlled input.
