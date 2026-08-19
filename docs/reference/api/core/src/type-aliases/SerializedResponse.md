[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedResponse

# Type Alias: SerializedResponse

> **SerializedResponse** = \{ `ok`: `true`; `kind`: `"query"`; `value`: `unknown`; `executedQueries?`: [`ExecutedQuery`](ExecutedQuery.md)[]; \} \| \{ `ok`: `true`; `kind`: `"persist"`; `changes`: `object`[]; \} \| \{ `ok`: `true`; `kind`: `"destroy"`; \} \| \{ `ok`: `false`; `error`: `string`; \}

Defined in: [core/src/plugins/wire/types.ts:95](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/types.ts#L95)

What a receiver sends back. Errors are a value, not a transport status.

## Type Declaration

\{ `ok`: `true`; `kind`: `"query"`; `value`: `unknown`; `executedQueries?`: [`ExecutedQuery`](ExecutedQuery.md)[]; \}

### ok

> **ok**: `true`

### kind

> **kind**: `"query"`

### value

> **value**: `unknown`

### executedQueries?

> `optional` **executedQueries**: [`ExecutedQuery`](ExecutedQuery.md)[]

`executedQueries` carries what the SERVER's plugin ran, so `.explain()` on a client sees
through the wire rather than reporting a blank. Optional on the response, unlike on a
local event: a plugin that does not report has nothing to send, and the client's
explanation then marks the remote step as not reported. There is no flag on either end —
the wire forwards whatever the plugin pushed, or nothing.

\{ `ok`: `true`; `kind`: `"persist"`; `changes`: `object`[]; \}

### ok

> **ok**: `true`

### kind

> **kind**: `"persist"`

### changes

> **changes**: `object`[]

\{ `ok`: `true`; `kind`: `"destroy"`; \}

### ok

> **ok**: `true`

### kind

> **kind**: `"destroy"`

\{ `ok`: `false`; `error`: `string`; \}

### ok

> **ok**: `false`

### error

> **error**: `string`
