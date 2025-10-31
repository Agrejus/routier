[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / AssignmentBuilder

# Class: AssignmentBuilder

Defined in: [core/src/codegen/blocks.ts:189](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L189)

## Extends

- [`ContainerBlock`](ContainerBlock.md)

## Constructors

### Constructor

> **new AssignmentBuilder**(`variableName`, `name?`, `parentIndent?`, `parent?`): `AssignmentBuilder`

Defined in: [core/src/codegen/blocks.ts:198](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L198)

#### Parameters

##### variableName

`string`

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](Block.md)

#### Returns

`AssignmentBuilder`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`constructor`](ContainerBlock.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`name`](ContainerBlock.md#name)

## Accessors

### getValue

#### Get Signature

> **get** **getValue**(): `string` \| [`Block`](Block.md)

Defined in: [core/src/codegen/blocks.ts:194](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L194)

##### Returns

`string` \| [`Block`](Block.md)

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

> **if**(`condition`, `options?`): [`IfBuilder`](IfBuilder.md)

Defined in: [core/src/codegen/blocks.ts:85](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L85)

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

> **assign**(`variableName`, `options?`): `AssignmentBuilder`

Defined in: [core/src/codegen/blocks.ts:120](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L120)

#### Parameters

##### variableName

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

`AssignmentBuilder`

#### Inherited from

[`ContainerBlock`](ContainerBlock.md).[`assign`](ContainerBlock.md#assign)

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

### value()

> **value**(`value`): `this`

Defined in: [core/src/codegen/blocks.ts:203](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L203)

#### Parameters

##### value

`string`

#### Returns

`this`

***

### and()

> **and**(`and`, `options?`): `this`

Defined in: [core/src/codegen/blocks.ts:208](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L208)

#### Parameters

##### and

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

`this`

***

### object()

> **object**(`options?`): [`ObjectBuilder`](ObjectBuilder.md)

Defined in: [core/src/codegen/blocks.ts:213](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L213)

#### Parameters

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ObjectBuilder`](ObjectBuilder.md)

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`object`](ContainerBlock.md#object)

***

### call()

> **call**(`functionName`, `options?`): [`ObjectBuilder`](ObjectBuilder.md)

Defined in: [core/src/codegen/blocks.ts:221](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L221)

#### Parameters

##### functionName

`string`

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`ObjectBuilder`](ObjectBuilder.md)

***

### string()

> **string**(`type`, `options?`): [`StringBuilder`](StringBuilder.md)

Defined in: [core/src/codegen/blocks.ts:230](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L230)

#### Parameters

##### type

[`StringType`](../type-aliases/StringType.md)

##### options?

[`CreateBlockOptions`](../type-aliases/CreateBlockOptions.md)

#### Returns

[`StringBuilder`](StringBuilder.md)

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:238](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L238)

#### Returns

`string`

#### Overrides

[`ContainerBlock`](ContainerBlock.md).[`toString`](ContainerBlock.md#tostring)
