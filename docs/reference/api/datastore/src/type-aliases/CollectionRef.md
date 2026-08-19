[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / CollectionRef

# Type Alias: CollectionRef\<TInner\>

> **CollectionRef**\<`TInner`\> = `object`

Defined in: [datastore/src/collections/types.ts:107](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/types.ts#L107)

A collection or view, seen as the inner side of a join.

Structural rather than `CollectionBase<TInner>` so the queryables can name it without
importing the collection they are built by. Views satisfy it because they extend
`CollectionBase` — which is a requirement, not a bonus: full-text search joins its index view
to its source collection.

## Type Parameters

### TInner

`TInner` *extends* `object`

## Methods

### joinSide()

> **joinSide**(): [`JoinSide`](JoinSide.md)\<`TInner`\>

Defined in: [datastore/src/collections/types.ts:108](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/collections/types.ts#L108)

#### Returns

[`JoinSide`](JoinSide.md)\<`TInner`\>
