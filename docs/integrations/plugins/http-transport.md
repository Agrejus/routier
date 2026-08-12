---
title: HTTP Transport
layout: default
parent: Plugins
nav_order: 9
permalink: /integrations/plugins/http-transport/
---

# HTTP Transport

A plugin with no database. It serializes the whole query and sends it to a server that has one.

## Quick Navigation

- [When To Use It](#when-to-use-it)
- [Client](#client)
- [Server](#server)
- [Securing The Endpoint](#securing-the-endpoint)
- [What Crosses The Wire](#what-crosses-the-wire)
- [What Stays Local](#what-stays-local)
- [Limits](#limits)
- [Related](#related)

## When To Use It

Use this when **both ends are yours** and both run Routier. The query travels intact, so the server
can push a filter to an index, run a real SQL `JOIN`, or compute an aggregate and return the answer
instead of the rows.

Use [`HttpDbPlugin`](/integrations/plugins/replication/) instead when the server is not yours — it
talks to an ordinary REST API, one GET per collection, with filters flattened into query parameters.

## Client

The client has no local storage at all:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-1.ts %}{% endhighlight %}


Then query it like any store. Nothing about the calling code changes:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-2.ts %}{% endhighlight %}


That is **one** request, and the join executes on the server.

## Server

`createRequestHandler` is one async function from JSON to JSON. It knows nothing about HTTP, so it
works behind Express, a Cloudflare Worker, a Lambda, a WebSocket, or a worker `postMessage`:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-3.ts %}{% endhighlight %}


Failures come back as `{ ok: false, error }` rather than as a thrown exception, so a query error
cannot accidentally become a 500 with no body. **You choose the status code** — only your route knows
whether "not signed in" is a 401 or a 403:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-1.ts %}{% endhighlight %}


Whatever status you pick, **return the body**. The client reads it: a non-2xx carrying a Routier
answer surfaces the error *message* the handler wrote, and only a response with no Routier answer in
it is reported as a transport failure. Sending a bare status would tell the caller "returned 403"
instead of which rule they broke.

## Securing The Endpoint

Routier supplies **no policy** — no user, no tenant, no role — because it cannot know what yours are.
It supplies two places a decision cannot be forgotten, and enforces both where the caller cannot
reach.

Both receive a `context` you build from the request. Build it from the request, **never from the
body** — the body is the part the client controls.


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-1.ts %}{% endhighlight %}


Name a context type and passing one becomes **required**, so a policy cannot be half-wired.

### `authorize` — may this caller do this at all?

Called once per request, *before* anything is deserialized or executed. Return `true` to allow, or
`false`/a string to refuse — the string becomes the error message.

It is told the action and **every collection the request touches, joins included**, so a policy can
refuse a join to a collection it would refuse directly:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-2.ts %}{% endhighlight %}


### `scope` — which rows may this caller touch?

A filter, written exactly like a collection's own `.scope()`. Return `null` for a collection this
caller may see in full. It is enforced in three places:

- **Reads** — ANDed in *first*, so no option the caller sends can displace it, and it is pushed down
  to the database rather than filtered afterwards.
- **Joins** — applied to the inner side too. Without that, a join would be a way to read an unscoped
  view of any other collection.
- **Writes** — every added, updated and removed row is checked against the same filter, and one row
  outside it refuses the whole save. Otherwise a caller who can only *read* their own rows could
  still *write* somebody else's.

A scope that cannot be expressed as a filter is **refused**, not ignored — it is the boundary between
callers, and one that quietly stops applying is worse than an error.

### `destroy` is refused by default

`HttpTransportDbPlugin` never sends one, but an endpoint answers whatever arrives. A hand-written
`{"kind":"destroy"}` would otherwise drop your database, so it is opt-in:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-3.ts %}{% endhighlight %}


It still passes through `authorize`.

### With no hooks

An endpoint with neither hook answers anything for anyone, for read *and* write, for every collection
in `schemas`. That is the correct default for a function with no idea who is calling it — and the
reason to reach for the hooks above rather than a check in the route alone.

## What Crosses The Wire

Everything below travels as JSON and is rebuilt against the **server's** schemas. Collections are
named, never described, so the server's definition of a collection is always the one that applies:

| Sent | Notes |
| --- | --- |
| `where` | As an expression tree, so the server can push it to an index or a `WHERE` clause |
| `sort`, `skip`, `take` | The selector is rebuilt from the property on arrival |
| `count`, `min`, `max`, `sum`, `distinct` | The server returns the answer, not the rows |
| `join` / `leftJoin` | Including the inner side's scopes — one request, not two |
| `nearest` | Vector and count |
| Saves | Adds, updates and removes, with the echo returned so identities come back |

## What Stays Local

`map` and `group` are defined *by* a closure, and a closure cannot be serialized. The plugin sends
the longest prefix it can and runs the rest itself:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/http-transport/block-6.ts %}{% endhighlight %}


It is a prefix rather than a filtered subset, and that matters: sending `count` while keeping `map`
local would count unmapped rows.

## Limits

- **No caching, no offline queue, no retry.** This is a transport, so what arrives at the server is
  exactly what the caller asked for. Compose [`HttpSwrDbPlugin`](/integrations/plugins/replication/)
  when you want those.
- **`destroy` is not forwarded.** It means "release what this plugin holds", and this plugin holds a
  URL. Forwarding it would let any client drop the server's database.
- **Both ends need the same collection names.** A name the server does not serve is refused with an
  error rather than an empty result.
- **Subscriptions are local.** Change notifications come from your own store's writes; this plugin
  does not open a channel to the server.

## Related

- [Joins](/concepts/queries/joins/) — what a forwarded join does on the far side
- [Replication](/integrations/plugins/replication/) — `HttpDbPlugin` and the SWR plugin
- [Plugins](/integrations/plugins/) — the plugin contract
