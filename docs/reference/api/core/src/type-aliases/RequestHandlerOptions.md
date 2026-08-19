[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RequestHandlerOptions

# Type Alias: RequestHandlerOptions\<TContext\>

> **RequestHandlerOptions**\<`TContext`\> = `object`

Defined in: [core/src/plugins/wire/handler.ts:110](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L110)

## Type Parameters

### TContext

`TContext`

## Properties

### plugin

> **plugin**: [`IDbPlugin`](../interfaces/IDbPlugin.md)

Defined in: [core/src/plugins/wire/handler.ts:112](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L112)

The plugin that actually holds the data. Anything implementing `IDbPlugin`.

***

### schemas

> **schemas**: [`ReadonlySchemaCollection`](../classes/ReadonlySchemaCollection.md)

Defined in: [core/src/plugins/wire/handler.ts:114](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L114)

Every collection this endpoint will answer for. A name absent from here is refused.

***

### authorize?

> `optional` **authorize**: [`AuthorizeHook`](AuthorizeHook.md)\<`TContext`\>

Defined in: [core/src/plugins/wire/handler.ts:116](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L116)

May this caller do this? See `AuthorizeHook`. Absent means yes, to everyone.

***

### scope?

> `optional` **scope**: [`ScopeHook`](ScopeHook.md)\<`TContext`\>

Defined in: [core/src/plugins/wire/handler.ts:118](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L118)

Which rows may this caller touch? See `ScopeHook`. Absent means all of them.

***

### allowDestroy?

> `optional` **allowDestroy**: `boolean`

Defined in: [core/src/plugins/wire/handler.ts:127](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L127)

Whether a `destroy` request may drop the database. **Defaults to false.**

`HttpTransportDbPlugin` never sends one, but an endpoint answers whatever arrives — and a
hand-written `{"kind":"destroy"}` would otherwise wipe the store for anyone who could reach
the route. Destroying a database is not something a remote caller should be able to ask for by
default, so it is opt-in and still passes through `authorize`.
