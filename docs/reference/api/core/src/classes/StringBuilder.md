[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / StringBuilder

# Class: StringBuilder

Defined in: [core/src/codegen/blocks.ts:147](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L147)

## Extends

- [`Block`](/reference/api/core/src/classes/Block)

## Constructors

### Constructor

> **new StringBuilder**(`type`, `name?`, `parentIndent?`, `parent?`): `StringBuilder`

Defined in: [core/src/codegen/blocks.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L151)

#### Parameters

##### type

[`StringType`](/reference/api/core/src/type-aliases/StringType)

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](/reference/api/core/src/classes/Block)

#### Returns

`StringBuilder`

#### Overrides

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

### append()

> **append**(`value`): `StringBuilder`

Defined in: [core/src/codegen/blocks.ts:156](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L156)

#### Parameters

##### value

`string`

#### Returns

`StringBuilder`

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:161](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/codegen/blocks.ts#L161)

#### Returns

`string`

#### Overrides

[`Block`](/reference/api/core/src/classes/Block).[`toString`](/reference/api/core/src/classes/Block#tostring)
