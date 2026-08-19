[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / AuthErrorHandler

# Type Alias: AuthErrorHandler()

> **AuthErrorHandler** = (`event`) => `void` \| `boolean` \| `Promise`\<`void` \| `boolean`\>

Defined in: [plugins/replication/src/auth.ts:28](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/auth.ts#L28)

Handler invoked when the remote returns 401/403. May return (or resolve to)
`true` to signal that re-authentication succeeded — e.g. a token refresh —
in which case the failed operation is retried ONCE with fresh headers.

## Parameters

### event

[`AuthErrorEvent`](../interfaces/AuthErrorEvent.md)

## Returns

`void` \| `boolean` \| `Promise`\<`void` \| `boolean`\>
