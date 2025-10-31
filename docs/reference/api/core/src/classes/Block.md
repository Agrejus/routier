[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Block

# Abstract Class: Block

Defined in: [core/src/codegen/blocks.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L10)

## Extended by

- [`ContainerBlock`](ContainerBlock.md)
- [`StringBuilder`](StringBuilder.md)
- [`VariableBuilder`](VariableBuilder.md)
- [`ObjectBuilder`](ObjectBuilder.md)
- [`ArrayBuilder`](ArrayBuilder.md)

## Constructors

### Constructor

> **new Block**(`name?`, `parentIndent?`, `parent?`): `Block`

Defined in: [core/src/codegen/blocks.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L16)

#### Parameters

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

`Block`

#### Returns

`Block`

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

## Methods

### indexOf()

> **indexOf**(`name`): `number`

Defined in: [core/src/codegen/blocks.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L22)

#### Parameters

##### name

`string`

#### Returns

`number`

***

### getOrDefault()

> **getOrDefault**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L26)

#### Type Parameters

##### T

`T` *extends* `Block`

#### Parameters

##### name

`string`

#### Returns

`T`

***

### get()

> **get**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:54](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L54)

#### Type Parameters

##### T

`T` *extends* `Block`

#### Parameters

##### name

`string`

#### Returns

`T`

***

### has()

> **has**(`name`): `boolean`

Defined in: [core/src/codegen/blocks.ts:64](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L64)

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### toString()

> `abstract` **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:81](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L81)

#### Returns

`string`
