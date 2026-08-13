[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / QueryOptionsCollection

# Class: QueryOptionsCollection\<T\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L6)

## Type Parameters

### T

`T`

## Constructors

### Constructor

> **new QueryOptionsCollection**\<`T`\>(): `QueryOptionsCollection`\<`T`\>

#### Returns

`QueryOptionsCollection`\<`T`\>

## Accessors

### items

#### Get Signature

> **get** **items**(): `Map`\<keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>, [`QueryCollectionItem`](/reference/api/core/src/type-aliases/QueryCollectionItem)\<`any`, `any`\>[]\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L13)

##### Returns

`Map`\<keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>, [`QueryCollectionItem`](/reference/api/core/src/type-aliases/QueryCollectionItem)\<`any`, `any`\>[]\>

***

### isEmpty

#### Get Signature

> **get** **isEmpty**(): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L17)

##### Returns

`boolean`

## Methods

### EMPTY()

> `static` **EMPTY**\<`R`\>(): `QueryOptionsCollection`\<`R`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L21)

#### Type Parameters

##### R

`R`

#### Returns

`QueryOptionsCollection`\<`R`\>

***

### isEmpty()

> `static` **isEmpty**\<`T`\>(`options`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L25)

#### Type Parameters

##### T

`T`

#### Parameters

##### options

`QueryOptionsCollection`\<`T`\>

#### Returns

`boolean`

***

### add()

> **add**\<`K`\>(`name`, `value`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L29)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>

#### Parameters

##### name

`K`

##### value

[`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`T`\>\[`K`\]

#### Returns

`void`

***

### split()

> **split**(): `object`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:80](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L80)

#### Returns

`object`

##### memory

> **memory**: `QueryOptionsCollection`\<`T`\>

##### database

> **database**: `QueryOptionsCollection`\<`T`\>

***

### has()

> **has**\<`K`\>(`name`): `boolean`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:104](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L104)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

`boolean`

***

### get()

> **get**\<`K`\>(`name`): [`QueryCollectionItem`](/reference/api/core/src/type-aliases/QueryCollectionItem)\<`T`, `K`\>[]

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:108](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L108)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryCollectionItem`](/reference/api/core/src/type-aliases/QueryCollectionItem)\<`T`, `K`\>[]

***

### getLast()

> **getLast**\<`K`\>(`name`): [`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`T`, `K`\>

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:112](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L112)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryOption`](/reference/api/core/src/type-aliases/QueryOption)\<`T`, `K`\>

***

### getValues()

> **getValues**\<`K`\>(`name`): [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`T`\>\[`K`\][]

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:126](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L126)

#### Type Parameters

##### K

`K` *extends* keyof [`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`unknown`\>

#### Parameters

##### name

`K`

#### Returns

[`QueryOptionValueMap`](/reference/api/core/src/type-aliases/QueryOptionValueMap)\<`T`\>\[`K`\][]

***

### forEach()

> **forEach**(`iterator`): `void`

Defined in: [core/src/plugins/query/QueryOptionsCollection.ts:147](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/QueryOptionsCollection.ts#L147)

#### Parameters

##### iterator

(`item`) => `void`

#### Returns

`void`
