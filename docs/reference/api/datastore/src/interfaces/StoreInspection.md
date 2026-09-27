[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / StoreInspection

# Interface: StoreInspection

Defined in: [datastore/src/inspection/types.ts:54](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L54)

## Properties

### plugin

> `readonly` **plugin**: [`InspectedPlugin`](InspectedPlugin.md)

Defined in: [datastore/src/inspection/types.ts:55](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L55)

***

### collections

> `readonly` **collections**: readonly [`InspectedCollection`](InspectedCollection.md)[]

Defined in: [datastore/src/inspection/types.ts:56](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L56)

***

### disposed

> `readonly` **disposed**: `AbortSignal`

Defined in: [datastore/src/inspection/types.ts:57](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L57)

## Methods

### watchQueries()

> **watchQueries**(`onQuery`): [`StopWatching`](../type-aliases/StopWatching.md)

Defined in: [datastore/src/inspection/types.ts:58](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L58)

#### Parameters

##### onQuery

(`query`) => `void`

#### Returns

[`StopWatching`](../type-aliases/StopWatching.md)
