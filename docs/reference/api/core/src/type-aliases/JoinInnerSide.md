[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JoinInnerSide

# Type Alias: JoinInnerSide

> **JoinInnerSide** = `object`

Defined in: [core/src/plugins/query/join.ts:39](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L39)

The inner side of a join, as the PLUGIN sees it.

Supplied by the plugin rather than fetched by the translator, because loading rows is the one
part of a join that is backend-specific: a memory plugin resolves a collection, Dexie opens a
store, Mongo reads a collection. Everything after that — deserializing, applying the inner
scopes, pairing — is identical, so it lives here and runs once.

Rows arrive in STORAGE shape, exactly as the plugin holds them; the translator deserializes
them with `innerSchema`, which the outer query's own deserialization would never do.

## Properties

### innerSchema

> **innerSchema**: [`CompiledSchemaCore`](CompiledSchemaCore.md)\<`any`\>

Defined in: [core/src/plugins/query/join.ts:40](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L40)

***

### innerRows

> **innerRows**: readonly `unknown`[]

Defined in: [core/src/plugins/query/join.ts:41](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/join.ts#L41)
