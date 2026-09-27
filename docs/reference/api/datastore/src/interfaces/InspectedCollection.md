[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / InspectedCollection

# Interface: InspectedCollection

Defined in: [datastore/src/inspection/types.ts:25](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L25)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [datastore/src/inspection/types.ts:26](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L26)

***

### schemaId

> `readonly` **schemaId**: `SchemaId`

Defined in: [datastore/src/inspection/types.ts:27](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L27)

***

### kind

> `readonly` **kind**: [`InspectedCollectionKind`](../type-aliases/InspectedCollectionKind.md)

Defined in: [datastore/src/inspection/types.ts:28](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L28)

## Methods

### count()

> **count**(): `Promise`\<`number`\>

Defined in: [datastore/src/inspection/types.ts:29](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L29)

#### Returns

`Promise`\<`number`\>

***

### keyOf()

> **keyOf**(`row`): `string`

Defined in: [datastore/src/inspection/types.ts:30](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L30)

#### Parameters

##### row

[`InspectedRow`](../type-aliases/InspectedRow.md)

#### Returns

`string`

***

### watchCount()

> **watchCount**(`onCount`): [`StopWatching`](../type-aliases/StopWatching.md)

Defined in: [datastore/src/inspection/types.ts:31](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L31)

#### Parameters

##### onCount

(`result`) => `void`

#### Returns

[`StopWatching`](../type-aliases/StopWatching.md)

***

### watchPage()

> **watchPage**(`page`, `onRows`): [`StopWatching`](../type-aliases/StopWatching.md)

Defined in: [datastore/src/inspection/types.ts:32](https://github.com/Agrejus/routier/blob/main/datastore/src/inspection/types.ts#L32)

#### Parameters

##### page

[`InspectedPageRequest`](InspectedPageRequest.md)

##### onRows

(`result`) => `void`

#### Returns

[`StopWatching`](../type-aliases/StopWatching.md)
