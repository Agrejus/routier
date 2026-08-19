[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / FunctionBuilder

# Class: FunctionBuilder

Defined in: [core/src/codegen/blocks.ts:513](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L513)

## Extends

- [`ContainerBlock`](ContainerBlock.md)

## Constructors

### Constructor

> **new FunctionBuilder**(`functionName?`, `sectionName?`, `parentIndent?`, `parent?`): `FunctionBuilder`

Defined in: [core/src/codegen/blocks.ts:518](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L518)

#### Parameters

##### functionName?

`string`

##### sectionName?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](Block.md)

#### Returns

`FunctionBuilder`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`constructor`](ContainerBlock.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`name`](ContainerBlock.md#name)

## Methods

### indexOf()

> **indexOf**(`name`): `number`

Defined in: [core/src/codegen/blocks.ts:22](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L22)

#### Parameters

##### name

`string`

#### Returns

`number`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`indexOf`](ContainerBlock.md#indexof)

***

### getLines()

> **getLines**(): `Line`[]

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L26)

#### Returns

`Line`[]

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`getLines`](ContainerBlock.md#getlines)

***

### getParent()

> **getParent**(): [`Block`](Block.md)

Defined in: [core/src/codegen/blocks.ts:30](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L30)

#### Returns

[`Block`](Block.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`getParent`](ContainerBlock.md#getparent)

***

### getIndent()

> **getIndent**(): `string`

Defined in: [core/src/codegen/blocks.ts:34](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L34)

#### Returns

`string`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`getIndent`](ContainerBlock.md#getindent)

***

### setLines()

> **setLines**(`lines`): `void`

Defined in: [core/src/codegen/blocks.ts:38](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L38)

#### Parameters

##### lines

`Line`[]

#### Returns

`void`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`setLines`](ContainerBlock.md#setlines)

***

### setParent()

> **setParent**(`block`): `void`

Defined in: [core/src/codegen/blocks.ts:42](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L42)

#### Parameters

##### block

[`Block`](Block.md)

#### Returns

`void`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`setParent`](ContainerBlock.md#setparent)

***

### setIndent()

> **setIndent**(`indent`): `void`

Defined in: [core/src/codegen/blocks.ts:46](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L46)

#### Parameters

##### indent

`string`

#### Returns

`void`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`setIndent`](ContainerBlock.md#setindent)

***

### getOrDefault()

> **getOrDefault**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:50](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L50)

#### Type Parameters

##### T

`T` *extends* [`Block`](Block.md)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`getOrDefault`](ContainerBlock.md#getordefault)

***

### get()

> **get**\<`T`\>(`name`): `T`

Defined in: [core/src/codegen/blocks.ts:79](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L79)

#### Type Parameters

##### T

`T` *extends* [`Block`](Block.md)

#### Parameters

##### name

`string`

#### Returns

`T`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`get`](ContainerBlock.md#get)

***

### has()

> **has**(`name`): `boolean`

Defined in: [core/src/codegen/blocks.ts:89](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L89)

#### Parameters

##### name

`string`

#### Returns

`boolean`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`has`](ContainerBlock.md#has)

***

### remove()

> **remove**(`name`): `void`

Defined in: [core/src/codegen/blocks.ts:93](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L93)

#### Parameters

##### name

`string`

#### Returns

`void`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`remove`](ContainerBlock.md#remove)

***

### replace()

> **replace**(`name`, `line`): `void`

Defined in: [core/src/codegen/blocks.ts:97](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L97)

#### Parameters

##### name

`string`

##### line

[`Block`](Block.md)

#### Returns

`void`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`replace`](ContainerBlock.md#replace)

***

### if()

> **if**(`condition`, `options?`): [`IfBuilder`](IfBuilder.md)

Defined in: [core/src/codegen/blocks.ts:140](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L140)

#### Parameters

##### condition

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`IfBuilder`](IfBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`if`](ContainerBlock.md#if)

***

### raw()

> **raw**(`raw`, `options?`): [`RawBuilder`](RawBuilder.md)

Defined in: [core/src/codegen/blocks.ts:151](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L151)

#### Parameters

##### raw

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`RawBuilder`](RawBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`raw`](ContainerBlock.md#raw)

***

### function()

> **function**(`name?`, `options?`): `FunctionBuilder`

Defined in: [core/src/codegen/blocks.ts:157](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L157)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

`FunctionBuilder`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`function`](ContainerBlock.md#function)

***

### factory()

> **factory**(`name?`, `options?`): [`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)

Defined in: [core/src/codegen/blocks.ts:163](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L163)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`factory`](ContainerBlock.md#factory)

***

### variable()

> **variable**(`declaration`, `options?`): [`VariableBuilder`](VariableBuilder.md)

Defined in: [core/src/codegen/blocks.ts:169](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L169)

#### Parameters

##### declaration

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`VariableBuilder`](VariableBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`variable`](ContainerBlock.md#variable)

***

### assign()

> **assign**(`variableName`, `options?`): [`AssignmentBuilder`](AssignmentBuilder.md)

Defined in: [core/src/codegen/blocks.ts:175](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L175)

#### Parameters

##### variableName

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`AssignmentBuilder`](AssignmentBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`assign`](ContainerBlock.md#assign)

***

### object()

> **object**(`options?`): [`ObjectBuilder`](ObjectBuilder.md)

Defined in: [core/src/codegen/blocks.ts:181](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L181)

#### Parameters

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ObjectBuilder`](ObjectBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`object`](ContainerBlock.md#object)

***

### slot()

> **slot**(`name`): [`SlotBlock`](SlotBlock.md)

Defined in: [core/src/codegen/blocks.ts:187](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L187)

#### Parameters

##### name

`string`

#### Returns

[`SlotBlock`](SlotBlock.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`slot`](ContainerBlock.md#slot)

***

### array()

> **array**(`accessor`, `options?`): [`ArrayBuilder`](ArrayBuilder.md)

Defined in: [core/src/codegen/blocks.ts:193](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L193)

#### Parameters

##### accessor

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ArrayBuilder`](ArrayBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`array`](ContainerBlock.md#array)

***

### parameters()

> **parameters**(...`params`): `this`

Defined in: [core/src/codegen/blocks.ts:523](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L523)

#### Parameters

##### params

...(`string` \| `GenericParam`)[]

#### Returns

`this`

***

### return()

> **return**(): `FunctionBuilder`

Defined in: [core/src/codegen/blocks.ts:528](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L528)

#### Returns

`FunctionBuilder`

***

### appendBody()

> **appendBody**(`line`): `this`

Defined in: [core/src/codegen/blocks.ts:533](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L533)

#### Parameters

##### line

`string`

#### Returns

`this`

***

### toCallable()

> **toCallable**(): `string`

Defined in: [core/src/codegen/blocks.ts:542](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L542)

#### Returns

`string`

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:546](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/codegen/blocks.ts#L546)

#### Returns

`string`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`toString`](ContainerBlock.md#tostring)
