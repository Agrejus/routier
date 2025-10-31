[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SubscriptionChanges

# Type Alias: SubscriptionChanges\<T\>

> **SubscriptionChanges**\<`T`\> = `object`

Defined in: [core/src/schema/types.ts:74](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L74)

Represents changes to subscriptions, categorizing them by modifications to
entities (additions, updates, removals) or query-driven removals.

## Type Parameters

### T

`T` *extends* `object`

The type of the entities in the subscription.

## Properties

### adds

> **adds**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:78](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L78)

Entities that have been added to the subscription.

***

### updates

> **updates**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:82](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L82)

Entities that have been updated within the subscription.

***

### removals

> **removals**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:86](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L86)

Entities that have been removed from the subscription.

***

### unknown

> **unknown**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:91](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L91)

Entities that have been added/updated/removed from the subscription and it is unknown 
if the entities have been added/updated/removed.
