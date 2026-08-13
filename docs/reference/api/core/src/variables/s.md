[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / s

# Variable: s

> `const` **s**: `object`

Defined in: [core/src/schema/builder.ts:45](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/builder.ts#L45)

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

> **string**: \{\<`T`\>(...`literals`): [`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>; \<`T`\>(`options`, ...`literals`): [`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>; \}

#### Call Signature

> \<`T`\>(...`literals`): [`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

A string, optionally declaring how long it can be and which values it may take.

```ts
s.string()                              // any string
s.string("draft", "published")          // a literal union
s.string({ maxLength: 4000 })           // any string, declared long
s.string({ maxLength: 8 }, "a", "b")    // both
```

The options object is a leading parameter rather than a `.maxLength()` modifier so the
declaration stays on the factory, next to the literals. A modifier would also have to survive
being wrapped by another modifier, which is the trap `SchemaBase.maxLength` documents.

##### Type Parameters

###### T

`T` *extends* `string`[] = `string`[]

##### Parameters

###### literals

...`T`

##### Returns

[`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

#### Call Signature

> \<`T`\>(`options`, ...`literals`): [`SchemaString`](../classes/SchemaString.md)\<`T`\[`number`\] *extends* `never` ? `string` : `T`\[`number`\], `never`\>

A string, optionally declaring how long it can be and which values it may take.

```ts
s.string()                              // any string
s.string("draft", "published")          // a literal union
s.string({ maxLength: 4000 })           // any string, declared long
s.string({ maxLength: 8 }, "a", "b")    // both
```

The options object is a leading parameter rather than a `.maxLength()` modifier so the
declaration stays on the factory, next to the literals. A modifier would also have to survive
being wrapped by another modifier, which is the trap `SchemaBase.maxLength` documents.

##### Type Parameters

###### T

`T` *extends* `string`[] = `string`[]

##### Parameters

###### options

[`StringOptions`](../type-aliases/StringOptions.md)

###### literals

...`T`

##### Returns

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

### file()

> **file**: () => [`SchemaFile`](../classes/SchemaFile.md)\<[`FileReferenceValue`](../type-aliases/FileReferenceValue.md), `never`\>

A file. Assign content, read back a reference.

Needs `@routier/blob-plugin` wrapping your plugin to turn the one into the other; core
only carries the value through untouched.

#### Returns

[`SchemaFile`](../classes/SchemaFile.md)\<[`FileReferenceValue`](../type-aliases/FileReferenceValue.md), `never`\>

### vector()

> **vector**: (`dimensions`) => [`SchemaVector`](../classes/SchemaVector.md)\<[`VectorValue`](../type-aliases/VectorValue.md), `never`\>

An embedding of `dimensions` numbers, searchable with `.nearest()`.

Every backend supports it. One with a native vector column uses it; the rest store the
numbers as JSON and score the search in memory, which returns the same rows.

#### Parameters

##### dimensions

`number`

#### Returns

[`SchemaVector`](../classes/SchemaVector.md)\<[`VectorValue`](../type-aliases/VectorValue.md), `never`\>

### define()

> **define**: \<`T`\>(`collectionName`, `schema`) => [`SchemaDefinition`](../classes/SchemaDefinition.md)\<`T`\>

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### collectionName

`string`

##### schema

`T`

#### Returns

[`SchemaDefinition`](../classes/SchemaDefinition.md)\<`T`\>
