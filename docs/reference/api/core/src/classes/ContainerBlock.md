[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ContainerBlock

# Abstract Class: ContainerBlock

Defined in: [core/src/codegen/blocks.ts:139](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L139)

## Extends

- [`Block`](Block.md)

## Extended by

- [`SlotBlock`](SlotBlock.md)
- [`AssignmentBuilder`](AssignmentBuilder.md)
- [`AndBuilder`](AndBuilder.md)
- [`RawBuilder`](RawBuilder.md)
- [`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)
- [`FunctionBuilder`](FunctionBuilder.md)
- [`IfBuilder`](IfBuilder.md)
- [`CodeBuilder`](CodeBuilder.md)

## Constructors

### Constructor

> **new ContainerBlock**(`name?`, `parentIndent?`, `parent?`): `ContainerBlock`

Defined in: [core/src/codegen/blocks.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L16)

#### Parameters

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](Block.md)

#### Returns

`ContainerBlock`

#### Inherited from

[`Block`](Block.md).[`constructor`](Block.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`Block`](Block.md).[`name`](Block.md#name)

## Methods

### indexOf()

> **indexOf**(`name`): `number`

Defined in: [core/src/codegen/blocks.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L22)

#### Parameters

##### name

`string`

#### Returns

`number`

#### Inherited from

[`Block`](Block.md).[`indexOf`](Block.md#indexof)

***

### getLines()

> **getLines**(): `Line`[]

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L26)

#### Returns

`Line`[]

#### Inherited from

[`Block`](Block.md).[`getLines`](Block.md#getlines)

***

### getParent()

> **getParent**(): [`Block`](Block.md)

Defined in: [core/src/codegen/blocks.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L30)

#### Returns

[`Block`](Block.md)

#### Inherited from

[`Block`](Block.md).[`getParent`](Block.md#getparent)

***

### getIndent()

> **getIndent**(): `string`

Defined in: [core/src/codegen/blocks.ts:34](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L34)

#### Returns

`string`

#### Inherited from

[`Block`](Block.md).[`getIndent`](Block.md#getindent)

***

### setLines()

> **setLines**(`lines`): `void`

Defined in: [core/src/codegen/blocks.ts:38](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L38)

#### Parameters

##### lines

`Line`[]

#### Returns

`void`

#### Inherited from

[`Block`](Block.md).[`setLines`](Block.md#setlines)

***

### setParent()

> **setParent**(`block`): `void`

Defined in: [core/src/codegen/blocks.ts:42](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L42)

#### Parameters

##### block

[`Block`](Block.md)

#### Returns

`void`

#### Inherited from

[`Block`](Block.md).[`setParent`](Block.md#setparent)

***

### setIndent()

> **setIndent**(`indent`): `void`

Defined in: [core/src/codegen/blocks.ts:46](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L46)

#### Parameters

##### indent

`string`

#### Returns

`void`

#### Inherited from

[`Block`](Block.md).[`setIndent`](Block.md#setindent)

***

### getOrDefault()

> **getOrDefault**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:50](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L50)

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

Defined in: [core/src/codegen/blocks.ts:79](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L79)

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

Defined in: [core/src/codegen/blocks.ts:89](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L89)

#### Parameters

##### name

`string`

#### Returns

`boolean`

#### Inherited from

[`Block`](Block.md).[`has`](Block.md#has)

***

### remove()

> **remove**(`name`): `void`

Defined in: [core/src/codegen/blocks.ts:93](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L93)

#### Parameters

##### name

`string`

#### Returns

`void`

#### Inherited from

[`Block`](Block.md).[`remove`](Block.md#remove)

***

### replace()

> **replace**(`name`, `line`): `void`

Defined in: [core/src/codegen/blocks.ts:97](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L97)

#### Parameters

##### name

`string`

##### line

[`Block`](Block.md)

#### Returns

`void`

#### Inherited from

[`Block`](Block.md).[`replace`](Block.md#replace)

***

### toString()

> `abstract` **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:136](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L136)

#### Returns

`string`

#### Inherited from

[`Block`](Block.md).[`toString`](Block.md#tostring)

***

### if()

> **if**(`condition`, `options?`): [`IfBuilder`](IfBuilder.md)

Defined in: [core/src/codegen/blocks.ts:140](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L140)

#### Parameters

##### condition

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`IfBuilder`](IfBuilder.md)

***

### raw()

> **raw**(`raw`, `options?`): [`RawBuilder`](RawBuilder.md)

Defined in: [core/src/codegen/blocks.ts:151](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L151)

#### Parameters

##### raw

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`RawBuilder`](RawBuilder.md)

***

### function()

> **function**(`name?`, `options?`): [`FunctionBuilder`](FunctionBuilder.md)

Defined in: [core/src/codegen/blocks.ts:157](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L157)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`FunctionBuilder`](FunctionBuilder.md)

***

### factory()

> **factory**(`name?`, `options?`): [`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)

Defined in: [core/src/codegen/blocks.ts:163](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L163)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)

***

### variable()

> **variable**(`declaration`, `options?`): [`VariableBuilder`](VariableBuilder.md)

Defined in: [core/src/codegen/blocks.ts:169](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L169)

#### Parameters

##### declaration

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`VariableBuilder`](VariableBuilder.md)

***

### assign()

> **assign**(`variableName`, `options?`): [`AssignmentBuilder`](AssignmentBuilder.md)

Defined in: [core/src/codegen/blocks.ts:175](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L175)

#### Parameters

##### variableName

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`AssignmentBuilder`](AssignmentBuilder.md)

***

### object()

> **object**(`options?`): [`ObjectBuilder`](ObjectBuilder.md)

Defined in: [core/src/codegen/blocks.ts:181](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L181)

#### Parameters

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ObjectBuilder`](ObjectBuilder.md)

***

### slot()

> **slot**(`name`): [`SlotBlock`](SlotBlock.md)

Defined in: [core/src/codegen/blocks.ts:187](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L187)

#### Parameters

##### name

`string`

#### Returns

[`SlotBlock`](SlotBlock.md)

***

### array()

> **array**(`accessor`, `options?`): [`ArrayBuilder`](ArrayBuilder.md)

Defined in: [core/src/codegen/blocks.ts:193](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/codegen/blocks.ts#L193)

#### Parameters

##### accessor

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ArrayBuilder`](ArrayBuilder.md)
