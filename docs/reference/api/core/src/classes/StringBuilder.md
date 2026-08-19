[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / StringBuilder

# Class: StringBuilder

Defined in: [core/src/codegen/blocks.ts:202](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L202)

## Extends

- [`Block`](Block.md)

## Constructors

### Constructor

> **new StringBuilder**(`type`, `name?`, `parentIndent?`, `parent?`): `StringBuilder`

Defined in: [core/src/codegen/blocks.ts:206](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L206)

#### Parameters

##### type

[`StringType`](../type-aliases/StringType.md)

##### name?

`string`

##### parentIndent?

`string` = `""`

##### parent?

[`Block`](Block.md)

#### Returns

`StringBuilder`

#### Overrides

[`Block`](Block.md).[`constructor`](Block.md#constructor)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/codegen/blocks.ts:11](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L11)

#### Inherited from

[`Block`](Block.md).[`name`](Block.md#name)

## Methods

### indexOf()

> **indexOf**(`name`): `number`

Defined in: [core/src/codegen/blocks.ts:22](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L22)

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

Defined in: [core/src/codegen/blocks.ts:26](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L26)

#### Returns

`Line`[]

#### Inherited from

[`Block`](Block.md).[`getLines`](Block.md#getlines)

***

### getParent()

> **getParent**(): [`Block`](Block.md)

Defined in: [core/src/codegen/blocks.ts:30](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L30)

#### Returns

[`Block`](Block.md)

#### Inherited from

[`Block`](Block.md).[`getParent`](Block.md#getparent)

***

### getIndent()

> **getIndent**(): `string`

Defined in: [core/src/codegen/blocks.ts:34](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L34)

#### Returns

`string`

#### Inherited from

[`Block`](Block.md).[`getIndent`](Block.md#getindent)

***

### setLines()

> **setLines**(`lines`): `void`

Defined in: [core/src/codegen/blocks.ts:38](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L38)

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

Defined in: [core/src/codegen/blocks.ts:42](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L42)

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

Defined in: [core/src/codegen/blocks.ts:46](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L46)

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

Defined in: [core/src/codegen/blocks.ts:50](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L50)

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

Defined in: [core/src/codegen/blocks.ts:79](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L79)

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

Defined in: [core/src/codegen/blocks.ts:89](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L89)

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

Defined in: [core/src/codegen/blocks.ts:93](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L93)

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

Defined in: [core/src/codegen/blocks.ts:97](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L97)

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

### append()

> **append**(`value`): `StringBuilder`

Defined in: [core/src/codegen/blocks.ts:211](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L211)

#### Parameters

##### value

`string`

#### Returns

`StringBuilder`

***

### toString()

> **toString**(): `string`

Defined in: [core/src/codegen/blocks.ts:216](https://github.com/Agrejus/routier/blob/main/core/src/codegen/blocks.ts#L216)

#### Returns

`string`

#### Overrides

[`Block`](Block.md).[`toString`](Block.md#tostring)
