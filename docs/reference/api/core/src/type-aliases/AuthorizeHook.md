[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / AuthorizeHook

# Type Alias: AuthorizeHook()\<TContext\>

> **AuthorizeHook**\<`TContext`\> = (`info`) => `boolean` \| `string` \| `Promise`\<`boolean` \| `string`\>

Defined in: [core/src/plugins/wire/handler.ts:82](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/handler.ts#L82)

May this request proceed?

`true` to allow. `false` or a string to refuse — a string becomes the error message, which is the
cheapest way to say WHY without inventing an error type. Throwing also refuses.

Called once, before deserialization, so a refused request never reaches a schema or a plugin.

## Type Parameters

### TContext

`TContext`

## Parameters

### info

[`RequestInfo`](RequestInfo.md)\<`TContext`\>

## Returns

`boolean` \| `string` \| `Promise`\<`boolean` \| `string`\>
