[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TranslatedArrayValue

# Class: TranslatedArrayValue\<T\>

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:3](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L3)

## Type Parameters

### T

`T`

## Implements

- [`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`T`\>

## Constructors

### Constructor

> **new TranslatedArrayValue**\<`T`\>(`value`, `isTransformed`): `TranslatedArrayValue`\<`T`\>

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:9](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L9)

#### Parameters

##### value

`unknown`

##### isTransformed

`boolean`

#### Returns

`TranslatedArrayValue`\<`T`\>

## Properties

### value

> `readonly` **value**: `T`

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:5](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L5)

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`value`](../interfaces/ITranslatedValue.md#value)

***

### isTransformed

> `readonly` **isTransformed**: `boolean`

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:6](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L6)

True if the translator remapped or transformed the data from the database shape;
false if the data is unchanged and in the same shape as the database.

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`isTransformed`](../interfaces/ITranslatedValue.md#istransformed)

***

### isEmpty

> `readonly` **isEmpty**: `boolean`

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:7](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L7)

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`isEmpty`](../interfaces/ITranslatedValue.md#isempty)

## Methods

### forEach()

> **forEach**(`callback`): `void`

Defined in: [core/src/plugins/translators/TranslatedArrayValue.ts:15](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/translators/TranslatedArrayValue.ts#L15)

Iterates over items in the collection, calling the callback for each item.
If the callback returns a value, that value replaces the original item (e.g. so
changeTracker.resolve() can swap in attached/merged entities).

#### Parameters

##### callback

(`item`) => `unknown`

Function called for each item. If it returns a value, that value replaces the original item.

#### Returns

`void`

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`forEach`](../interfaces/ITranslatedValue.md#foreach)
