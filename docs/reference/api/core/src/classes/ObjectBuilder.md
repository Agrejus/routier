[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ObjectBuilder

# Class: ObjectBuilder

Defined in: [core/src/codegen/blocks.ts:325](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L325)

## Extends

- [`Block`](Block.md)

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

[`Block`](Block.md)

#### Returns

`ObjectBuilder`

#### Inherited from

[`Block`](Block.md).[`constructor`](Block.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`Block`](Block.md).[`name`](Block.md#name)

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

[`Block`](Block.md).[`indexOf`](Block.md#indexof)

***

### getOrDefault()

> **getOrDefault**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L26)

#### Type Parameters

##### T

`T` *extends* [`Block`](Block.md)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`Block`](Block.md).[`getOrDefault`](Block.md#getordefault)

***

### get()

> **get**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:54](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L54)

#### Type Parameters

##### T

`T` *extends* [`Block`](Block.md)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`Block`](Block.md).[`get`](Block.md#get)

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

[`Block`](Block.md).[`has`](Block.md#has)

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

[`Block`](Block.md).[`toString`](Block.md#tostring)
