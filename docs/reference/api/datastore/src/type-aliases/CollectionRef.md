[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / CollectionRef

# Type Alias: CollectionRef\<TInner\>

> **CollectionRef**\<`TInner`\> = `object`

Defined in: [datastore/src/collections/types.ts:107](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L107)

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

Defined in: [datastore/src/collections/types.ts:108](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/collections/types.ts#L108)

#### Returns

[`JoinSide`](JoinSide.md)\<`TInner`\>
