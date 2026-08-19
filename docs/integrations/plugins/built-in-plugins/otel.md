---
title: OpenTelemetry
---

# OpenTelemetry

`@routier/otel-plugin` wraps any `IDbPlugin` and emits one OpenTelemetry span per operation. It
stores nothing itself — it is a [wrapper plugin](/integrations/plugins/built-in-plugins/wrappers).

## Install

```bash
npm install @routier/otel-plugin @opentelemetry/api
```

`@opentelemetry/api` is a peer dependency. The SDK belongs to your application, so this package
ships no runtime dependencies of its own.

## Usage

```ts
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { OtelDbPlugin } from "@routier/otel-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new OtelDbPlugin(new MemoryPlugin("my-database")));
  }
}
```

Pass a `Tracer` as the second argument to use your own instrumentation scope:

```ts
new OtelDbPlugin(inner, trace.getTracer("my-app"))
```

Without one it uses `trace.getTracer("routier")`, which is a no-op until your application
registers a tracer provider.

## What it emits

One span per operation, named `routier.query`, `routier.bulkPersist`, or `routier.destroy`.

| Attribute | Value |
| --- | --- |
| `db.system` | The inner plugin's `databaseName` |
| `db.collection.name` | Comma-joined collection names the operation touched |
| `routier.source` | The component that triggered the operation |
| `routier.event.id` | Id of the plugin event |
| `db.query.text` | What the plugin reported executing, when it reports at all |

The inner plugin runs inside the span's context, so any spans it creates itself nest underneath.

`db.query.text` is populated from the same mechanism that powers
[`.explain()`](/concepts/queries/explain) — a plugin that reports nothing simply leaves the
attribute unset.

## Failure semantics

A failed or partly-applied operation records the exception and sets the span status to `ERROR`;
a partial save also sets the status message to `"partial"`.

Span bookkeeping never fails a data operation. If setting an attribute or status throws, it is
swallowed, the span still ends, and the result reaches the caller untouched.

## Alternatives

For timings without an OpenTelemetry pipeline, use `TelemetryDbPlugin` from `@routier/core` — it
emits a plain event per operation and defaults to the levelled logger. See
[Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers#telemetrydbplugin).
