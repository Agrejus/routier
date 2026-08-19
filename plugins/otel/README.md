# @routier/otel-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

OpenTelemetry tracing for any Routier plugin. It wraps a plugin and emits one span per
operation; it stores nothing itself.

## Install

```bash
npm install @routier/otel-plugin @opentelemetry/api
```

`@opentelemetry/api` is a peer dependency. The OTel SDK belongs to your application, so this
package ships no runtime dependencies.

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

Pass a `Tracer` as the second argument to name your own instrumentation scope. Without one the
plugin uses `trace.getTracer("routier")`, which is a no-op until your application registers a
tracer provider.

## What it emits

One span per operation, named `routier.query`, `routier.bulkPersist`, or `routier.destroy`.

| Attribute | Value |
| --- | --- |
| `db.system` | The inner plugin's `databaseName` |
| `db.collection.name` | Comma-joined collection names the operation touched |
| `routier.source` | The component that triggered the operation |
| `routier.event.id` | Id of the plugin event |
| `db.query.text` | What the plugin reported executing, when it reports at all |

The inner plugin runs inside the span's context, so spans it creates itself nest underneath.

A failed or partly-applied operation records the exception and sets the span status to `ERROR`.
Span bookkeeping never fails a data operation: a broken attribute or status call is swallowed,
the span still ends, and the result reaches the caller untouched.

## Alternatives

For timings without an OTel pipeline, use `TelemetryDbPlugin` from `@routier/core` — it emits a
plain event per operation and defaults to the levelled logger.

## See also

- [Routier documentation](https://routier.dev)
