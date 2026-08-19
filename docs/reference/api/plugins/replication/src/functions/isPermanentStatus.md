[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / isPermanentStatus

# Function: isPermanentStatus()

> **isPermanentStatus**(`status`): `boolean`

Defined in: [plugins/replication/src/httpUtils.ts:37](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/httpUtils.ts#L37)

A permanent failure: the same request will never succeed, so retrying is
waste and the change should dead-letter. Auth (401/403) is special-cased by
callers (re-auth may fix it), 408/429 are transient by definition, and
anything 5xx or network-level is transient.

## Parameters

### status

`number`

## Returns

`boolean`
