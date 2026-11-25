[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RequestInfo

# Type Alias: RequestInfo\<TContext\>

> **RequestInfo**\<`TContext`\> = `object`

Defined in: [core/src/plugins/wire/handler.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L65)

What a hook is told about the request it is judging.

## Type Parameters

### TContext

`TContext`

## Properties

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/wire/handler.ts:66](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L66)

***

### collectionNames

> **collectionNames**: `string`[]

Defined in: [core/src/plugins/wire/handler.ts:68](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L68)

Every collection this request touches, including the inner side of any join.

***

### context

> **context**: `TContext`

Defined in: [core/src/plugins/wire/handler.ts:70](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L70)

Whatever the transport built from the request — a user, a tenant, a token. Never the body.

***

### request

> **request**: [`SerializedRequest`](SerializedRequest.md)

Defined in: [core/src/plugins/wire/handler.ts:72](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L72)

The raw request, for a policy that needs to look closer. Treat it as caller-controlled input.
