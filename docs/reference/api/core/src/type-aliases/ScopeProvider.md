[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ScopeProvider

# Type Alias: ScopeProvider()

> **ScopeProvider** = (`schema`) => [`Expression`](../classes/Expression.md) \| `null`

Defined in: [core/src/plugins/wire/query.ts:172](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/query.ts#L172)

A filter the RECEIVER adds to every read of a collection, whatever the sender asked for.

Returns `null` for a collection with nothing to add. See `createRequestHandler` for the policy
side; this is only how it reaches the options.

## Parameters

### schema

[`CompiledSchema`](CompiledSchema.md)\<`any`\>

## Returns

[`Expression`](../classes/Expression.md) \| `null`
