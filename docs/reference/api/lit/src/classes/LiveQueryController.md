[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [lit/src](../README.md) / LiveQueryController

# Class: LiveQueryController\<T, TArgs\>

Defined in: lit/src/LiveQueryController.ts:17

## Type Parameters

### T

`T`

### TArgs

`TArgs` *extends* readonly [`LiveQueryArgument`](../type-aliases/LiveQueryArgument.md)[] = readonly \[\]

## Implements

- `ReactiveController`

## Constructors

### Constructor

> **new LiveQueryController**\<`T`, `TArgs`\>(`host`, `options`): `LiveQueryController`\<`T`, `TArgs`\>

Defined in: lit/src/LiveQueryController.ts:24

#### Parameters

##### host

`ReactiveControllerHost`

##### options

[`LiveQueryControllerOptions`](../type-aliases/LiveQueryControllerOptions.md)\<`T`, `TArgs`\>

#### Returns

`LiveQueryController`\<`T`, `TArgs`\>

## Properties

### state

> **state**: [`LiveQueryState`](../../../react/src/type-aliases/LiveQueryState.md)\<`T`\>

Defined in: lit/src/LiveQueryController.ts:18

***

### hostUpdate()?

> `optional` **hostUpdate**: () => `void`

Defined in: lit/src/LiveQueryController.ts:19

Called during the client-side host update, just before the host calls
its own update.

Code in `update()` can depend on the DOM as it is not called in
server-side rendering.

#### Returns

`void`

#### Implementation of

`ReactiveController.hostUpdate`

## Methods

### hostConnected()

> **hostConnected**(): `void`

Defined in: lit/src/LiveQueryController.ts:48

Called when the host is connected to the component tree. For custom
element hosts, this corresponds to the `connectedCallback()` lifecycle,
which is only called when the component is connected to the document.

#### Returns

`void`

#### Implementation of

`ReactiveController.hostConnected`

***

### hostDisconnected()

> **hostDisconnected**(): `void`

Defined in: lit/src/LiveQueryController.ts:52

Called when the host is disconnected from the component tree. For custom
element hosts, this corresponds to the `disconnectedCallback()` lifecycle,
which is called the host or an ancestor component is disconnected from the
document.

#### Returns

`void`

#### Implementation of

`ReactiveController.hostDisconnected`
