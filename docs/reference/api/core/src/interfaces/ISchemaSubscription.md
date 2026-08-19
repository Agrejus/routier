[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ISchemaSubscription

# Interface: ISchemaSubscription\<T\>

Defined in: [core/src/schema/types.ts:171](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L171)

## Extends

- `Disposable`

## Type Parameters

### T

`T` *extends* `object`

## Methods

### send()

> **send**(`changes`): `void`

Defined in: [core/src/schema/types.ts:172](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L172)

#### Parameters

##### changes

[`SubscriptionChanges`](../type-aliases/SubscriptionChanges.md)\<`T`\>

#### Returns

`void`

***

### onMessage()

> **onMessage**(`callback`): `void`

Defined in: [core/src/schema/types.ts:173](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L173)

#### Parameters

##### callback

(`changes`) => `void`

#### Returns

`void`

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: node\_modules/typescript/lib/lib.esnext.disposable.d.ts:36

#### Returns

`void`

#### Inherited from

`Disposable.[dispose]`
