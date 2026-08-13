[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / VariableBuilder

# Class: VariableBuilder

Defined in: [core/src/codegen/blocks.ts:268](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L268)

## Extends

- [`Block`](/reference/api/core/src/classes/Block)

## Constructors

### Constructor

> **new VariableBuilder**(`declaration`, `name?`, `parentIndent?`, `parent?`): `VariableBuilder`

Defined in: [core/src/codegen/blocks.ts:276](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L276)

#### Parameters

##### declaration

`string`

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](/reference/api/core/src/classes/Block)

#### Returns

`VariableBuilder`

#### Overrides

[`Block`](/reference/api/core/src/classes/Block).[`constructor`](/reference/api/core/src/classes/Block#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`Block`](/reference/api/core/src/classes/Block).[`name`](/reference/api/core/src/classes/Block#name)

## Accessors

### getValue

#### Get Signature

> **get** **getValue**(): `string` \| [`Block`](/reference/api/core/src/classes/Block)

Defined in: [core/src/codegen/blocks.ts:272](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L272)

##### Returns

`string` \| [`Block`](/reference/api/core/src/classes/Block)

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

### value()

> **value**(`value`): `this`

Defined in: [core/src/codegen/blocks.ts:281](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L281)

#### Parameters

##### value

`string`

#### Returns

`this`

***

### object()

> **object**(`options?`): [`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

Defined in: [core/src/codegen/blocks.ts:286](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L286)

#### Parameters

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`ObjectBuilder`](/reference/api/core/src/classes/ObjectBuilder)

***

### array()

> **array**(`accessor`, `options?`): [`ArrayBuilder`](/reference/api/core/src/classes/ArrayBuilder)

Defined in: [core/src/codegen/blocks.ts:294](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L294)

#### Parameters

##### accessor

`string`

##### options?

[`CreateBlockOptions`](/reference/api/core/src/type-aliases/CreateBlockOptions)

#### Returns

[`ArrayBuilder`](/reference/api/core/src/classes/ArrayBuilder)

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:302](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L302)

#### Returns

`string`

#### Overrides

[`Block`](/reference/api/core/src/classes/Block).[`toString`](/reference/api/core/src/classes/Block#tostring)
