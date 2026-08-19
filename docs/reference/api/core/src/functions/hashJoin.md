[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / hashJoin

# Function: hashJoin()

> **hashJoin**(`options`): [`JoinTuple`](../type-aliases/JoinTuple.md)[]

Defined in: [core/src/plugins/query/join.ts:177](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/join.ts#L177)

The join itself: one hash join, written once, called from every interpreter.

O(n + m) rather than a nested loop, which is the whole reason the API takes explicit key
selectors instead of a free-form predicate. Both key properties are `string` or `number` by
a build-time rule, so the keys are hashable and compare the same way in JS and in SQL.

Semantics, exactly as `specs/joins.md` states them:

 - **Null keys** never match. Under `left` the outer row still appears, paired with
   `undefined`.
 - **Duplicates** produce every pair: the full cross product per key group.
 - **Ordering** is outer order, then inner order within a key group. Undefined by contract —
   a caller who cares sorts.

## Parameters

### options

#### kind

[`JoinKind`](../type-aliases/JoinKind.md)

#### outerRows

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

#### innerRows

[`UnknownRecord`](../type-aliases/UnknownRecord.md)[]

#### outerKey

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

#### innerKey

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

## Returns

[`JoinTuple`](../type-aliases/JoinTuple.md)[]
