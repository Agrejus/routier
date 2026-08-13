[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / JoinSide

# Type Alias: JoinSide\<TInner\>

> **JoinSide**\<`TInner`\> = `object`

Defined in: [datastore/src/collections/types.ts:93](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L93)

What a join needs from the collection on the OTHER side.

Three things, and each earns its place. The schema deserializes the inner half of every tuple
and resolves the inner key. The scoped options carry the inner collection's soft-delete scope
and `.scope()` filters, which a join bypasses the read path of and would otherwise lose. The
plugin decides who interprets the join at all: same instance and the option travels to it,
different instance and the datastore has to run both sides itself.

Compared by INSTANCE, never by `databaseName` — two plugins over one database are still two
interpreters, and neither can read the other's rows.

## Type Parameters

### TInner

`TInner` *extends* `object`

## Properties

### schema

> `readonly` **schema**: `CompiledSchema`\<`TInner`\>

Defined in: [datastore/src/collections/types.ts:94](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L94)

***

### plugin

> `readonly` **plugin**: `IDbPlugin`

Defined in: [datastore/src/collections/types.ts:95](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L95)

***

### scopedQueryOptions

> `readonly` **scopedQueryOptions**: `QueryOptionsCollection`\<`TInner`\>

Defined in: [datastore/src/collections/types.ts:96](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L96)
