[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / DataStoreOptions

# Type Alias: DataStoreOptions

> **DataStoreOptions** = `object`

Defined in: [datastore/src/types.ts:6](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/types.ts#L6)

Store-wide settings. Every field is optional and has a default that suits an ordinary store.

## Properties

### semiJoinKeyThreshold?

> `optional` **semiJoinKeyThreshold**: `number`

Defined in: [datastore/src/types.ts:16](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/types.ts#L16)

How many distinct outer keys are still worth sending as an `IN (...)` prefilter when a join
reads its inner side. Default 500.

Purely a cost knob. Below it, the inner read is narrowed to keys the outer side actually has;
above it, the inner side is read under its own scopes and the surplus is discarded by the
hash join. Both produce the same pairs — raise it if your inner collections are large and
your engine is happy with long parameter lists, lower it if they are not.

***

### crossTabSync?

> `optional` **crossTabSync**: `boolean`

Defined in: [datastore/src/types.ts:32](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/types.ts#L32)

Whether live queries must keep working across browser tabs, or across worker threads in
Node. Default `true`.

Leave it alone unless saves are hot. Change notifications travel over a BroadcastChannel,
and a sender cannot see who is listening on the other side of one, so by default every
save preprocesses its changes and publishes them on the chance that a second tab is
listening. Set this to `false` when the process is the only one reading the database —
a server, a script, a single-tab app — and that work is skipped whenever nothing in this
process is subscribed. Worth roughly 10-18% of save time.

Setting it to `false` while a second tab IS subscribed does not error. That tab simply
stops receiving updates.
