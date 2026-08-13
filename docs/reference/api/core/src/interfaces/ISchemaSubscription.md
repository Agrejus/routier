[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / ISchemaSubscription

# Interface: ISchemaSubscription\<T\>

Defined in: [core/src/schema/types.ts:94](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L94)

## Extends

- `Disposable`

## Type Parameters

### T

`T` *extends* `object`

## Methods

### send()

> **send**(`changes`): `void`

Defined in: [core/src/schema/types.ts:95](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L95)

#### Parameters

##### changes

[`SubscriptionChanges`](/reference/api/core/src/type-aliases/SubscriptionChanges)\<`T`\>

#### Returns

`void`

***

### onMessage()

> **onMessage**(`callback`): `void`

Defined in: [core/src/schema/types.ts:96](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L96)

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
