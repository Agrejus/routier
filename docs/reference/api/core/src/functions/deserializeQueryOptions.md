[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / deserializeQueryOptions

# Function: deserializeQueryOptions()

> **deserializeQueryOptions**(`serialized`, `schema`, `resolveSchema`, `scopeFor?`): [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

Defined in: [core/src/plugins/wire/query.ts:187](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/wire/query.ts#L187)

Rebuilds query options from their wire form, against the receiver's own schemas.

The closures that were dropped are reconstructed here rather than sent:

- a **sort selector** from its property, which is all `JsonTranslator.sort` reads;
- a **filter predicate** from its expression tree, via `toStrictPredicate` — which THROWS rather
  than keeping a row it cannot judge, because on a receiver a filter that quietly stops filtering
  returns rows the requester excluded.

## Parameters

### serialized

[`SerializedQueryOption`](../type-aliases/SerializedQueryOption.md)[]

### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

### resolveSchema

[`SchemaResolver`](../type-aliases/SchemaResolver.md)

### scopeFor?

[`ScopeProvider`](../type-aliases/ScopeProvider.md)

A receiver-side filter per collection, applied to this collection AND to every collection a
join reaches. Prepended, so it is ANDed with whatever the sender sent and there is no order of
options that removes it.

## Returns

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

## Throws

when a named property or collection is not declared by the receiver's schemas. A payload
describing data this side does not have is a disagreement, and it has to be loud.
