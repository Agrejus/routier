[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TranslatedGroupValue

# Class: TranslatedGroupValue\<T\>

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:3](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L3)

## Type Parameters

### T

`T`

## Implements

- [`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`T`\>

## Constructors

### Constructor

> **new TranslatedGroupValue**\<`T`\>(`value`, `isTransformed`): `TranslatedGroupValue`\<`T`\>

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L9)

#### Parameters

##### value

`unknown`

##### isTransformed

`boolean`

#### Returns

`TranslatedGroupValue`\<`T`\>

## Properties

### value

> `readonly` **value**: `T`

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:5](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L5)

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`value`](../interfaces/ITranslatedValue.md#value)

***

### isTransformed

> `readonly` **isTransformed**: `boolean`

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:6](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L6)

True if the translator remapped or transformed the data from the database shape;
false if the data is unchanged and in the same shape as the database.

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`isTransformed`](../interfaces/ITranslatedValue.md#istransformed)

***

### isEmpty

> `readonly` **isEmpty**: `boolean`

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:7](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L7)

#### Implementation of

[`ITranslatedValue`](../interfaces/ITranslatedValue.md).[`isEmpty`](../interfaces/ITranslatedValue.md#isempty)

## Methods

### forEach()

> **forEach**(`callback`): `void`

Defined in: [core/src/plugins/translators/TranslatedGroupValue.ts:15](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/TranslatedGroupValue.ts#L15)

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
