[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / AuthErrorEvent

# Interface: AuthErrorEvent

Defined in: [plugins/replication/src/auth.ts:12](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/auth.ts#L12)

Event passed to onAuthError when the remote returns 401 Unauthorized or 403 Forbidden.
Higher-level code can use this to trigger re-authentication (e.g. refresh token, redirect to login).

## Properties

### status

> **status**: `401` \| `403`

Defined in: [plugins/replication/src/auth.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/auth.ts#L14)

HTTP status that triggered the event.

***

### message

> **message**: `string`

Defined in: [plugins/replication/src/auth.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/auth.ts#L16)

Human-readable message (e.g. from response statusText).

***

### originalError

> **originalError**: `Error`

Defined in: [plugins/replication/src/auth.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/auth.ts#L18)

The error thrown or constructed from the response.

***

### context

> **context**: `"query"` \| `"bulkPersist"`

Defined in: [plugins/replication/src/auth.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/replication/src/auth.ts#L20)

Whether this came from a query (GET) or bulkPersist (POST).
