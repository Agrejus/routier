[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / AuthorizeHook

# Type Alias: AuthorizeHook()\<TContext\>

> **AuthorizeHook**\<`TContext`\> = (`info`) => `boolean` \| `string` \| `Promise`\<`boolean` \| `string`\>

Defined in: [core/src/plugins/wire/handler.ts:81](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/handler.ts#L81)

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
