[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ITranslatedValue

# Interface: ITranslatedValue\<T\>

Defined in: [core/src/plugins/translators/types.ts:1](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/types.ts#L1)

## Type Parameters

### T

`T`

## Properties

### value

> `readonly` **value**: `T`

Defined in: [core/src/plugins/translators/types.ts:2](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/types.ts#L2)

***

### isTransformed

> `readonly` **isTransformed**: `boolean`

Defined in: [core/src/plugins/translators/types.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/types.ts#L16)

True if the translator remapped or transformed the data from the database shape;
false if the data is unchanged and in the same shape as the database.

***

### isEmpty

> `readonly` **isEmpty**: `boolean`

Defined in: [core/src/plugins/translators/types.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/types.ts#L18)

## Methods

### forEach()

> **forEach**(`callback`): `void`

Defined in: [core/src/plugins/translators/types.ts:10](https://github.com/Agrejus/routier/blob/main/core/src/plugins/translators/types.ts#L10)

Iterates over items in the collection, calling the callback for each item.
If the callback returns a value, that value replaces the original item (e.g. so
changeTracker.resolve() can swap in attached/merged entities).

#### Parameters

##### callback

(`item`) => `unknown`

Function called for each item. If it returns a value, that value replaces the original item.

#### Returns

`void`
