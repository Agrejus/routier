[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Block

# Abstract Class: Block

Defined in: [core/src/codegen/blocks.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L10)

## Extended by

- [`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock)
- [`StringBuilder`](/reference/api/core/src/classes/StringBuilder)
- [`VariableBuilder`](/reference/api/core/src/classes/VariableBuilder)
- [`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)
- [`ArrayBuilder`](/reference/api/core/src/classes/ArrayBuilder)

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
