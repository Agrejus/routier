[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / RawBuilder

# Class: RawBuilder

Defined in: [core/src/codegen/blocks.ts:312](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L312)

## Extends

- [`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock)

## Constructors

### Constructor

> **new RawBuilder**(`raw`, `name?`, `parentIndent?`, `parent?`): `RawBuilder`

Defined in: [core/src/codegen/blocks.ts:315](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L315)

#### Parameters

##### raw

`string`

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](/reference/api/core/src/classes/Block)

#### Returns

`RawBuilder`

#### Overrides

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`constructor`](/reference/api/core/src/classes/ContainerBlock#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`name`](/reference/api/core/src/classes/ContainerBlock#name)

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

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`indexOf`](/reference/api/core/src/classes/ContainerBlock#indexof)

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

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`getOrDefault`](/reference/api/core/src/classes/ContainerBlock#getordefault)

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

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`get`](/reference/api/core/src/classes/ContainerBlock#get)

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

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`has`](/reference/api/core/src/classes/ContainerBlock#has)

***

### if()

> **if**(`condition`, `options?`): [`IfBuilder`](/reference/api/core/src/classes/IfBuilder)

Defined in: [core/src/codegen/blocks.ts:85](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L85)

#### Parameters

##### condition

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`IfBuilder`](/reference/api/core/src/classes/IfBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`if`](/reference/api/core/src/classes/ContainerBlock#if)

***

### raw()

> **raw**(`raw`, `options?`): `RawBuilder`

Defined in: [core/src/codegen/blocks.ts:96](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L96)

#### Parameters

##### raw

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

`RawBuilder`

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`raw`](/reference/api/core/src/classes/ContainerBlock#raw)

***

### function()

> **function**(`name?`, `options?`): [`FunctionBuilder`](/reference/api/core/src/classes/FunctionBuilder)

Defined in: [core/src/codegen/blocks.ts:102](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L102)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`FunctionBuilder`](/reference/api/core/src/classes/FunctionBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`function`](/reference/api/core/src/classes/ContainerBlock#function)

***

### factory()

> **factory**(`name?`, `options?`): [`FunctionFactoryBuilder`](/reference/api/core/src/classes/FunctionFactoryBuilder)

Defined in: [core/src/codegen/blocks.ts:108](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L108)

#### Parameters

##### name?

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`FunctionFactoryBuilder`](/reference/api/core/src/classes/FunctionFactoryBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`factory`](/reference/api/core/src/classes/ContainerBlock#factory)

***

### variable()

> **variable**(`declaration`, `options?`): [`VariableBuilder`](/reference/api/core/src/classes/VariableBuilder)

Defined in: [core/src/codegen/blocks.ts:114](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L114)

#### Parameters

##### declaration

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`VariableBuilder`](/reference/api/core/src/classes/VariableBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`variable`](/reference/api/core/src/classes/ContainerBlock#variable)

***

### assign()

> **assign**(`variableName`, `options?`): [`AssignmentBuilder`](/reference/api/core/src/classes/AssignmentBuilder)

Defined in: [core/src/codegen/blocks.ts:120](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L120)

#### Parameters

##### variableName

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`AssignmentBuilder`](/reference/api/core/src/classes/AssignmentBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`assign`](/reference/api/core/src/classes/ContainerBlock#assign)

***

### object()

> **object**(`options?`): [`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

Defined in: [core/src/codegen/blocks.ts:126](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L126)

#### Parameters

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`object`](/reference/api/core/src/classes/ContainerBlock#object)

***

### slot()

> **slot**(`name`): [`SlotBlock`](/reference/api/core/src/classes/SlotBlock)

Defined in: [core/src/codegen/blocks.ts:132](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L132)

#### Parameters

##### name

`string`

#### Returns

[`SlotBlock`](/reference/api/core/src/classes/SlotBlock)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`slot`](/reference/api/core/src/classes/ContainerBlock#slot)

***

### array()

> **array**(`accessor`, `options?`): [`ArrayBuilder`](/reference/api/core/src/classes/ArrayBuilder)

Defined in: [core/src/codegen/blocks.ts:138](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L138)

#### Parameters

##### accessor

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`ArrayBuilder`](/reference/api/core/src/classes/ArrayBuilder)

#### Inherited from

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`array`](/reference/api/core/src/classes/ContainerBlock#array)

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:320](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L320)

#### Returns

`string`

#### Overrides

[`ContainerBlock`](/reference/api/core/src/classes/ContainerBlock).[`toString`](/reference/api/core/src/classes/ContainerBlock#tostring)
