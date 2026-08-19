[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SubscriptionChanges

# Type Alias: SubscriptionChanges\<T\>

> **SubscriptionChanges**\<`T`\> = `object`

Defined in: [core/src/schema/types.ts:151](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L151)

Represents changes to subscriptions, categorizing them by modifications to
entities (additions, updates, removals) or query-driven removals.

## Type Parameters

### T

`T` *extends* `object`

The type of the entities in the subscription.

## Properties

### adds

> **adds**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:155](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L155)

Entities that have been added to the subscription.

***

### updates

> **updates**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:159](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L159)

Entities that have been updated within the subscription.

***

### removals

> **removals**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:163](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L163)

Entities that have been removed from the subscription.

***

### unknown

> **unknown**: [`InferType`](InferType.md)\<`T`\>[]

Defined in: [core/src/schema/types.ts:168](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L168)

Entities that have been added/updated/removed from the subscription and it is unknown 
if the entities have been added/updated/removed.
