[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ScopeProvider

# Type Alias: ScopeProvider()

> **ScopeProvider** = (`schema`) => [`Expression`](../classes/Expression.md) \| `null`

Defined in: [core/src/plugins/wire/query.ts:172](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/query.ts#L172)

A filter the RECEIVER adds to every read of a collection, whatever the sender asked for.

Returns `null` for a collection with nothing to add. See `createRequestHandler` for the policy
side; this is only how it reaches the options.

## Parameters

### schema

[`CompiledSchema`](CompiledSchema.md)\<`any`\>

## Returns

[`Expression`](../classes/Expression.md) \| `null`
