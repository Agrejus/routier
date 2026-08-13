[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Query

# Class: Query\<TRoot, TShape\>

Defined in: [core/src/plugins/query/Query.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L6)

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Implements

- [`IQuery`](/reference/api/core/src/type-aliases/IQuery)\<`TRoot`, `TShape`\>

## Constructors

### Constructor

> **new Query**\<`TRoot`, `TShape`\>(`options`, `schema`, `enableChangeTrackingOverride?`): `Query`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/query/Query.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L12)

#### Parameters

##### options

[`QueryOptionsCollection`](/reference/api/core/src/classes/QueryOptionsCollection)\<`TShape`\>

##### schema

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`TRoot`\>

##### enableChangeTrackingOverride?

`boolean`

#### Returns

`Query`\<`TRoot`, `TShape`\>

## Properties

### options

> `readonly` **options**: [`QueryOptionsCollection`](/reference/api/core/src/classes/QueryOptionsCollection)\<`TShape`\>

Defined in: [core/src/plugins/query/Query.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L8)

Query options (sort, skip, take, etc.).

#### Implementation of

[`IQuery`](/reference/api/core/src/type-aliases/IQuery).[`options`](/reference/api/core/src/type-aliases/IQuery#options)

***

### schema

> `readonly` **schema**: [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`TRoot`\>

Defined in: [core/src/plugins/query/Query.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/Query.ts#L9)

#### Implementation of

[`IQuery`](/reference/api/core/src/type-aliases/IQuery).[`schema`](/reference/api/core/src/type-aliases/IQuery#schema)

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

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

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

[`IQuery`](/reference/api/core/src/type-aliases/IQuery)\<`T`, `S`\>

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

[`IQuery`](/reference/api/core/src/type-aliases/IQuery)\<`TRoot`, `TShape`\>

#### Returns

`string`
