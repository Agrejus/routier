[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / ContainerBlock

# Abstract Class: ContainerBlock

Defined in: [core/src/codegen/blocks.ts:84](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L84)

## Extends

- [`Block`](/reference/api/core/src/classes/Block)

## Extended by

- [`SlotBlock`](/reference/api/core/src/classes/SlotBlock)
- [`AssignmentBuilder`](/reference/api/core/src/classes/AssignmentBuilder)
- [`AndBuilder`](/reference/api/core/src/classes/AndBuilder)
- [`RawBuilder`](/reference/api/core/src/classes/RawBuilder)
- [`FunctionFactoryBuilder`](/reference/api/core/src/classes/FunctionFactoryBuilder)
- [`FunctionBuilder`](/reference/api/core/src/classes/FunctionBuilder)
- [`IfBuilder`](/reference/api/core/src/classes/IfBuilder)
- [`CodeBuilder`](/reference/api/core/src/classes/CodeBuilder)

## Constructors

### Constructor

> **new ContainerBlock**(`name?`, `parentIndent?`, `parent?`): `ContainerBlock`

Defined in: [core/src/codegen/blocks.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L16)

#### Parameters

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](/reference/api/core/src/classes/Block)

#### Returns

`ContainerBlock`

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

### toString()

> `abstract` **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:81](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L81)

#### Returns

`string`

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`toString`](/reference/api/core/src/classes/Block#tostring)

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

***

### raw()

> **raw**(`raw`, `options?`): [`RawBuilder`](/reference/api/core/src/classes/RawBuilder)

Defined in: [core/src/codegen/blocks.ts:96](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L96)

#### Parameters

##### raw

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`RawBuilder`](/reference/api/core/src/classes/RawBuilder)

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

***

### object()

> **object**(`options?`): [`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

Defined in: [core/src/codegen/blocks.ts:126](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L126)

#### Parameters

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

***

### slot()

> **slot**(`name`): [`SlotBlock`](/reference/api/core/src/classes/SlotBlock)

Defined in: [core/src/codegen/blocks.ts:132](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L132)

#### Parameters

##### name

`string`

#### Returns

[`SlotBlock`](/reference/api/core/src/classes/SlotBlock)

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
