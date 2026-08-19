[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / nearestBy

# Function: nearestBy()

> **nearestBy**\<`T`\>(`rows`, `vector`, `count`, `select`): `T`[]

Defined in: [core/src/plugins/query/similarity.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/similarity.ts#L65)

The `count` rows closest to `vector`, nearest first.

Distances are computed once per row rather than inside the comparator: a comparison-time
computation runs O(n log n) times over vectors that are commonly 1536 wide, which turns an
ordering into the dominant cost of the query.

The sort is stable, so rows at equal distance keep the order the backend returned them in.
That is not a guarantee worth relying on across backends — two engines can hand back the
same rows in different orders — but it does mean this function never introduces a
difference of its own.

## Type Parameters

### T

`T`

## Parameters

### rows

readonly `T`[]

### vector

`number`[]

### count

`number`

### select

(`row`) => readonly `number`[]

## Returns

`T`[]
