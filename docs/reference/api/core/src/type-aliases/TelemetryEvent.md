[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TelemetryEvent

# Type Alias: TelemetryEvent

> **TelemetryEvent** = `object`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:15

Measures every operation an inner plugin performs and hands one event per call to a sink.

```ts
const store = new MyStore(new TelemetryDbPlugin(new SomeDbPlugin(...)));
```

## Properties

### operation

> **operation**: `"query"` \| `"bulkPersist"` \| `"destroy"`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:16

***

### eventId

> **eventId**: `string`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:18

`id` of the plugin event that produced this measurement.

***

### source

> **source**: `string`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:20

The class/component that triggered the operation (`event.source`).

***

### schemas

> **schemas**: `string`[]

Defined in: core/src/plugins/TelemetryDbPlugin.ts:22

Collection names involved, from `event.schemas`.

***

### durationMs

> **durationMs**: `number`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:23

***

### ok

> **ok**: `"success"` \| `"partial"` \| `"error"`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:24

***

### error?

> `optional` **error**: `unknown`

Defined in: core/src/plugins/TelemetryDbPlugin.ts:26

Present when ok is "error" or "partial".
