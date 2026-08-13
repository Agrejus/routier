[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / s

# Variable: s

> `const` **s**: `object`

Defined in: [core/src/schema/builder.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/builder.ts#L10)

## Type Declaration

### number()

> **number**: \<`T`\>(...`literals`) => [`SchemaNumber`](/reference/api/core/src/classes/SchemaNumber)\<`T`\[`number`\] *extends* `never` ? `number` : `T`\[`number`\], `never`\>

#### Type Parameters

##### T

`T` *extends* `number`[] = `number`[]

#### Parameters

##### literals

...`T`

#### Returns

[`SchemaNumber`](/reference/api/core/src/classes/SchemaNumber)\<`T`\[`number`\] *extends* `never` ? `number` : `T`\[`number`\], `never`\>

### string()

> **string**: \<`T`\>(...`literals`) => [`SchemaString`](/reference/api/core/src/classes/SchemaString)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

#### Type Parameters

##### T

`T` *extends* `string`[] = `string`[]

#### Parameters

##### literals

...`T`

#### Returns

[`SchemaString`](/reference/api/core/src/classes/SchemaString)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

### boolean()

> **boolean**: \<`T`\>() => [`SchemaBoolean`](/reference/api/core/src/classes/SchemaBoolean)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `boolean` = `boolean`

#### Returns

[`SchemaBoolean`](/reference/api/core/src/classes/SchemaBoolean)\<`T`, `never`\>

### date()

> **date**: \<`T`\>() => [`SchemaDate`](/reference/api/core/src/classes/SchemaDate)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `Date` = `Date`

#### Returns

[`SchemaDate`](/reference/api/core/src/classes/SchemaDate)\<`T`, `never`\>

### array()

> **array**: \<`T`\>(`schema`) => [`SchemaArray`](/reference/api/core/src/classes/SchemaArray)\<[`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `never`\>, `never`\>

#### Type Parameters

##### T

`T` *extends* `unknown`

#### Parameters

##### schema

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `never`\>

#### Returns

[`SchemaArray`](/reference/api/core/src/classes/SchemaArray)\<[`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `never`\>, `never`\>

### object()

> **object**: \<`T`\>(`schema`) => [`SchemaObject`](/reference/api/core/src/classes/SchemaObject)\<`T`, `never`\>

#### Type Parameters

##### T

`T` *extends* `object` = \{ \}

#### Parameters

##### schema

`T`

#### Returns

[`SchemaObject`](/reference/api/core/src/classes/SchemaObject)\<`T`, `never`\>

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
