[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / s

# Variable: s

> `const` **s**: `object`

Defined in: [core/src/schema/builder.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/builder.ts#L10)

## Type Declaration

### number()

> **number**: \<`T`\>(...`literals`) => [`SchemaNumber`](../classes/SchemaNumber.md)\<`T`\[`number`\] *extends* `never` ? `number` : `T`\[`number`\], `never`\>

#### Type Parameters

##### T

`T` *extends* `number`[] = `number`[]

#### Parameters

##### literals

...`T`

#### Returns

[`SchemaNumber`](../classes/SchemaNumber.md)\<`T`\[`number`\] *extends* `never` ? `number` : `T`\[`number`\], `never`\>

### string()

> **string**: \<`T`\>(...`literals`) => [`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

#### Type Parameters

##### T

`T` *extends* `string`[] = `string`[]

#### Parameters

##### literals

...`T`

#### Returns

[`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

### boolean()

> **boolean**: \<`T`\>() => [`SchemaBoolean`](../classes/SchemaBoolean.md)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `boolean` = `boolean`

#### Returns

[`SchemaBoolean`](../classes/SchemaBoolean.md)\<`T`, `never`\>

### date()

> **date**: \<`T`\>() => [`SchemaDate`](../classes/SchemaDate.md)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `Date` = `Date`

#### Returns

[`SchemaDate`](../classes/SchemaDate.md)\<`T`, `never`\>

### array()

> **array**: \<`T`\>(`schema`) => [`SchemaArray`](../classes/SchemaArray.md)\<[`SchemaBase`](../classes/SchemaBase.md)\<`T`, `never`\>, `never`\>

#### Type Parameters

##### T

`T` *extends* `unknown`

#### Parameters

##### schema

[`SchemaBase`](../classes/SchemaBase.md)\<`T`, `never`\>

#### Returns

[`SchemaArray`](../classes/SchemaArray.md)\<[`SchemaBase`](../classes/SchemaBase.md)\<`T`, `never`\>, `never`\>

### object()

> **object**: \<`T`\>(`schema`) => [`SchemaObject`](../classes/SchemaObject.md)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `object` = \{ \}

#### Parameters

##### schema

`T`

#### Returns

[`SchemaObject`](../classes/SchemaObject.md)\<`T`, `never`\>

### define()

> **define**: \<`T`\>(`collectionName`, `schema`) => `SchemaDefinition`\<`T`\>

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### collectionName

`string`

##### schema

`T`

#### Returns

`SchemaDefinition`\<`T`\>
