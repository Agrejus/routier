[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / joinInPlugin

# Function: joinInPlugin()

> **joinInPlugin**\<`TRoot`, `TShape`\>(`event`, `query`, `done`): `void`

Defined in: [core/src/plugins/query/join.ts:428](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L428)

Interprets a join by running TWO ordinary queries through the plugin's own read path.

The whole of interpretation 2 for a plugin that has no reason to do anything cleverer, and the
shape every non-SQL backend should prefer:

```ts
query(event, done) {
    if (event.operation.options.has("join")) {
        joinInPlugin(event, (e, d) => this.query(e, d), done);
        return;
    }
    // ...the ordinary single-collection path
}
```

**The outer side runs FIRST, and that ordering is the optimization.** Its keys are what narrow
the inner read to rows that can actually pair — and they do not exist until the outer filters
have run. Loading the inner side first, which is what a naive implementation does, means reading
and materializing a whole collection to pair it with three rows.

Neither query carries the join option, so both take the plugin's normal path: its indexes, its
pushdown decisions, its retries. Nothing recurses, because the option is stripped before either
goes out.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Parameters

### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TRoot`, `TShape`\>

### query

(`innerEvent`, `done`) => `void`

How this plugin runs a query. NOT necessarily `plugin.query` — a plugin that
serializes queries through a work queue must pass its UN-QUEUED path, or the two reads below
wait on the slot this one is holding.

### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>\>

## Returns

`void`
