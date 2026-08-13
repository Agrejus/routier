[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpTransportDbPluginOptions

# Type Alias: HttpTransportDbPluginOptions

> **HttpTransportDbPluginOptions** = `object`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:60](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/HttpTransportDbPlugin.ts#L60)

A plugin that owns no database.

Every other plugin translates a query into some storage system's language. This one translates it
into JSON and sends it somewhere that has a database — the WHOLE query, filters and joins and all,
not a URL with a few parameters hung off it. The receiver (`createRequestHandler`) rebuilds it
against its own schemas and runs it on a real plugin.

```ts
// client
const store = new MyStore(new HttpTransportDbPlugin({ url: "https://api.example.com/routier" }));

// server
const handle = createRequestHandler({ plugin: new SqliteDbPlugin("app.db"), schemas });
app.post("/routier", async (req, res) => res.json(await handle(req.body)));
```

## How it differs from `HttpDbPlugin`

`HttpDbPlugin` talks to an ordinary REST API: a GET per collection, with filters flattened into
query parameters that a hand-written server interprets however it likes. It is the right choice
when the server is not yours.

This one assumes both ends are Routier. Because the query travels intact, the server can push a
filter to an index, execute a real SQL `JOIN`, or run an aggregate — and return the answer rather
than the rows. That is the difference between asking for a collection and asking a question.

## What still happens locally

`map` and `group` are defined BY a closure, so they cannot be sent. `splitSendableOptions` finds
the longest sendable PREFIX and this plugin runs the remainder itself with `JsonTranslator` — the
same thing every plugin does with what its backend could not do. Ordering makes the prefix rule
necessary rather than tidy: sending `count` while keeping `map` local would count unmapped rows.

## What it does not do

No caching, no offline queue, no retry. `HttpSwrDbPlugin` is the plugin for those, and composing
them is the intended path rather than growing this one — it stays a transport, so that what
arrives at the server is exactly what the caller asked for.

## Properties

### url

> **url**: `string`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:62](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/HttpTransportDbPlugin.ts#L62)

The single endpoint every request is POSTed to.

***

### databaseName?

> `optional` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/HttpTransportDbPlugin.ts#L70)

Identifies the database BEHIND the endpoint — see `IDbPlugin.databaseName`.

Defaults to the URL, which is the honest answer: from this side, the endpoint IS the database,
and two stores pointed at one URL should share subscription channels. Override it when several
endpoints front the same database and should therefore be treated as one.

***

### getHeaders()?

> `optional` **getHeaders**: () => `Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:72](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/HttpTransportDbPlugin.ts#L72)

Headers per request, so a token refreshed between calls is picked up. Async is allowed.

#### Returns

`Record`\<`string`, `string`\> \| `Promise`\<`Record`\<`string`, `string`\>\>

***

### request()?

> `optional` **request**: (`url`, `body`, `headers`) => `Promise`\<`SerializedResponse`\>

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:74](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/HttpTransportDbPlugin.ts#L74)

Replaces `fetch`, for tests or for a non-fetch transport.

#### Parameters

##### url

`string`

##### body

`SerializedRequest`

##### headers

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<`SerializedResponse`\>
