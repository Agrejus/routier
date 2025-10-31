[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / IfBuilder

# Class: IfBuilder

Defined in: [core/src/codegen/blocks.ts:527](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L527)

## Extends

- [`ContainerBlock`](ContainerBlock.md)

## Constructors

### Constructor

> **new IfBuilder**(`condition`, `name?`, `parentIndent?`, `parent?`): `IfBuilder`

Defined in: [core/src/codegen/blocks.ts:530](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L530)

#### Parameters

##### condition

`string`

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](Block.md)

#### Returns

`IfBuilder`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`constructor`](ContainerBlock.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`name`](ContainerBlock.md#name)

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

[`ContainerBlock`](ContainerBlock.md).[`indexOf`](ContainerBlock.md#indexof)

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

[`ContainerBlock`](ContainerBlock.md).[`getOrDefault`](ContainerBlock.md#getordefault)

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

[`ContainerBlock`](ContainerBlock.md).[`get`](ContainerBlock.md#get)

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

[`ContainerBlock`](ContainerBlock.md).[`has`](ContainerBlock.md#has)

***

### if()

> **if**(`condition`, `options?`): `IfBuilder`

Defined in: [core/src/codegen/blocks.ts:85](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L85)

#### Parameters

##### condition

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

`IfBuilder`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`if`](ContainerBlock.md#if)

***

### raw()

> **raw**(`raw`, `options?`): [`RawBuilder`](RawBuilder.md)

Defined in: [core/src/codegen/blocks.ts:96](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L96)

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

> **function**(`name?`, `options?`): [`FunctionBuilder`](FunctionBuilder.md)

Defined in: [core/src/codegen/blocks.ts:102](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L102)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`FunctionBuilder`](FunctionBuilder.md)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`function`](ContainerBlock.md#function)

***

### factory()

> **factory**(`name?`, `options?`): [`FunctionFactoryBuilder`](FunctionFactoryBuilder.md)

Defined in: [core/src/codegen/blocks.ts:108](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L108)

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

Defined in: [core/src/codegen/blocks.ts:114](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L114)

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

Defined in: [core/src/codegen/blocks.ts:120](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L120)

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

Defined in: [core/src/codegen/blocks.ts:126](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L126)

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

Defined in: [core/src/codegen/blocks.ts:132](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L132)

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

Defined in: [core/src/codegen/blocks.ts:138](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L138)

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

### appendBody()

> **appendBody**(`line`): `this`

Defined in: [core/src/codegen/blocks.ts:535](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L535)

#### Parameters

##### line

`string`

#### Returns

`this`

***

### unshiftBody()

> **unshiftBody**(`line`): `this`

Defined in: [core/src/codegen/blocks.ts:540](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L540)

#### Parameters

##### line

`string`

#### Returns

`this`

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:557](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L557)

#### Returns

`string`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`toString`](ContainerBlock.md#tostring)
