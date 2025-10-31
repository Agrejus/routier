[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Query

# Class: Query\<TRoot, TShape\>

Defined in: [core/src/plugins/query/Query.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L6)

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Implements

- [`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

## Constructors

### Constructor

> **new Query**\<`TRoot`, `TShape`\>(`options`, `schema`, `enableChangeTrackingOverride?`): `Query`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/query/Query.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L12)

#### Parameters

##### options

[`QueryOptionsCollection`](QueryOptionsCollection.md)\<`TShape`\>

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`TRoot`\>

##### enableChangeTrackingOverride?

`boolean`

#### Returns

`Query`\<`TRoot`, `TShape`\>

## Properties

### options

> `readonly` **options**: [`QueryOptionsCollection`](QueryOptionsCollection.md)\<`TShape`\>

Defined in: [core/src/plugins/query/Query.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L8)

Query options (sort, skip, take, etc.).

#### Implementation of

[`IQuery`](../type-aliases/IQuery.md).[`options`](../type-aliases/IQuery.md#options)

***

### schema

> `readonly` **schema**: [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`TRoot`\>

Defined in: [core/src/plugins/query/Query.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L9)

#### Implementation of

[`IQuery`](../type-aliases/IQuery.md).[`schema`](../type-aliases/IQuery.md#schema)

## Accessors

### changeTracking

#### Get Signature

> **get** **changeTracking**(): `boolean`

Defined in: [core/src/plugins/query/Query.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L23)

Whether change tracking is enabled for the query result.
Only enabled when the response is not reduced/aggregated/mapped.

##### Returns

`boolean`

#### Implementation of

`IQuery.changeTracking`

## Methods

### EMPTY()

> `static` **EMPTY**\<`T`, `S`\>(`schema`): `Query`\<`T`, `S`\>

Defined in: [core/src/plugins/query/Query.ts:49](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L49)

#### Type Parameters

##### T

`T` *extends* `object`

##### S

`S`

#### Parameters

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

#### Returns

`Query`\<`T`, `S`\>

***

### isEmpty()

> `static` **isEmpty**\<`T`, `S`\>(`query`): `boolean`

Defined in: [core/src/plugins/query/Query.ts:53](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L53)

#### Type Parameters

##### T

`T` *extends* `object`

##### S

`S`

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`T`, `S`\>

#### Returns

`boolean`

***

### toString()

> `static` **toString**\<`TRoot`, `TShape`\>(`query`): `string`

Defined in: [core/src/plugins/query/Query.ts:57](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L57)

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape`

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

#### Returns

`string`
