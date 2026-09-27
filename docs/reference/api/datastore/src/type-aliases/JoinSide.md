[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / JoinSide

# Type Alias: JoinSide\<TInner\>

> **JoinSide**\<`TInner`\> = `object`

Defined in: [datastore/src/collections/types.ts:97](https://github.com/Agrejus/routier/blob/main/datastore/src/collections/types.ts#L97)

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

Defined in: [datastore/src/collections/types.ts:98](https://github.com/Agrejus/routier/blob/main/datastore/src/collections/types.ts#L98)

***

### plugin

> `readonly` **plugin**: `IDbPlugin`

Defined in: [datastore/src/collections/types.ts:99](https://github.com/Agrejus/routier/blob/main/datastore/src/collections/types.ts#L99)

***

### scopedQueryOptions

> `readonly` **scopedQueryOptions**: `QueryOptionsCollection`\<`TInner`\>

Defined in: [datastore/src/collections/types.ts:100](https://github.com/Agrejus/routier/blob/main/datastore/src/collections/types.ts#L100)
