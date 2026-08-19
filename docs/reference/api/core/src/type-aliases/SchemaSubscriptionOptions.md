[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaSubscriptionOptions

# Type Alias: SchemaSubscriptionOptions

> **SchemaSubscriptionOptions** = `object`

Defined in: [core/src/schema/communication/broadcast.ts:13](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/communication/broadcast.ts#L13)

## Properties

### crossTabSync?

> `optional` **crossTabSync**: `boolean`

Defined in: [core/src/schema/communication/broadcast.ts:24](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/communication/broadcast.ts#L24)

Whether changes must reach listeners OUTSIDE this process — another browser tab, or
another worker thread in Node. Default `true`, which is the historical behaviour.

It cannot be inferred. A BroadcastChannel gives a sender no way to ask who is on the
other end, so `send` can only count the listeners registered in THIS process. When
this is `true`, `send` must assume a listener it cannot see and always publish. When
a caller sets it to `false`, it promises there is no such listener, and `send` skips
the whole preprocess-and-post step whenever nobody local is listening.
