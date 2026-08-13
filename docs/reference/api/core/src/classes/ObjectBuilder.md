[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / ObjectBuilder

# Class: ObjectBuilder

Defined in: [core/src/codegen/blocks.ts:325](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L325)

## Extends

- [`Block`](/reference/api/core/src/classes/Block)

## Constructors

### Constructor

> **new ObjectBuilder**(`name?`, `parentIndent?`, `parent?`): `ObjectBuilder`

Defined in: [core/src/codegen/blocks.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L16)

#### Parameters

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](/reference/api/core/src/classes/Block)

#### Returns

`ObjectBuilder`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`constructor`](/reference/api/core/src/classes/Block#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`name`](/reference/api/core/src/classes/Block#name)

## Methods

### indexOf()

> **indexOf**(`name`): `number`

Defined in: [core/src/codegen/blocks.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L22)

#### Parameters

##### name

`string`

#### Returns

`number`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`indexOf`](/reference/api/core/src/classes/Block#indexof)

***

### getOrDefault()

> **getOrDefault**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L26)

#### Type Parameters

##### T

`T` *extends* [`Block`](/reference/api/core/src/classes/Block)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`getOrDefault`](/reference/api/core/src/classes/Block#getordefault)

***

### get()

> **get**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:54](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L54)

#### Type Parameters

##### T

`T` *extends* [`Block`](/reference/api/core/src/classes/Block)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`get`](/reference/api/core/src/classes/Block#get)

***

### has()

> **has**(`name`): `boolean`

Defined in: [core/src/codegen/blocks.ts:64](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L64)

#### Parameters

##### name

`string`

#### Returns

`boolean`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`has`](/reference/api/core/src/classes/Block#has)

***

### property()

> **property**(`line`): `ObjectBuilder`

Defined in: [core/src/codegen/blocks.ts:327](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L327)

#### Parameters

##### line

`string`

#### Returns

`ObjectBuilder`

***

### nested()

> **nested**(`propertyName`, `name?`): `ObjectBuilder`

Defined in: [core/src/codegen/blocks.ts:339](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L339)

#### Parameters

##### propertyName

`string`

##### name?

`string`

#### Returns

`ObjectBuilder`

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:357](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L357)

#### Returns

`string`

#### Overrides

[`Block`](/reference/api/core/src/classes/Block).[`toString`](/reference/api/core/src/classes/Block#tostring)
