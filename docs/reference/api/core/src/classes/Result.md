[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Result

# Class: Result

Defined in: [core/src/results/Result.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L32)

## Extends

- `BaseResult`

## Constructors

### Constructor

> **new Result**(): `Result`

#### Returns

`Result`

#### Inherited from

`BaseResult.constructor`

## Properties

### ERROR

> `static` **ERROR**: `"error"`

Defined in: [core/src/results/Result.ts:4](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L4)

#### Inherited from

`BaseResult.ERROR`

***

### SUCCESS

> `static` **SUCCESS**: `"success"`

Defined in: [core/src/results/Result.ts:5](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L5)

#### Inherited from

`BaseResult.SUCCESS`

***

### PARTIAL

> `static` **PARTIAL**: `"partial"`

Defined in: [core/src/results/Result.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L6)

#### Inherited from

`BaseResult.PARTIAL`

## Methods

### resolve()

> `static` **resolve**\<`T`\>(`result`, `resolve`, `reject`): `void`

Defined in: [core/src/results/Result.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L8)

#### Type Parameters

##### T

`T`

#### Parameters

##### result

\{ `error`: `any`; `ok`: `"error"`; \} | \{ `data`: `T`; `ok`: `"success"`; \} | \{ `data`: `T`; `ok`: `"partial"`; `error`: `any`; \}

##### resolve

(`data`) => `void`

##### reject

(`error?`) => `void`

#### Returns

`void`

#### Inherited from

`BaseResult.resolve`

***

### assertSuccess()

> `static` **assertSuccess**\<`T`\>(`result`): `asserts result is { ok: "success"; data: T }`

Defined in: [core/src/results/Result.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L25)

#### Type Parameters

##### T

`T`

#### Parameters

##### result

`any`

#### Returns

`asserts result is { ok: "success"; data: T }`

#### Inherited from

`BaseResult.assertSuccess`

***

### success()

#### Call Signature

> `static` **success**\<`T`\>(`data`): [`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L33)

##### Type Parameters

###### T

`T`

##### Parameters

###### data

`T`

##### Returns

[`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`T`\>

#### Call Signature

> `static` **success**\<`T`\>(): [`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`never`\>

Defined in: [core/src/results/Result.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L34)

##### Type Parameters

###### T

`T`

##### Returns

[`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`never`\>

***

### error()

> `static` **error**\<`T`\>(`error`): [`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:42](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L42)

#### Type Parameters

##### T

`T`

#### Parameters

##### error

`any`

#### Returns

[`ResultType`](/reference/api/core/src/type-aliases/ResultType)\<`T`\>

***

### partial()

> `static` **partial**\<`T`\>(`data`, `error`): [`PartialResultType`](/reference/api/core/src/type-aliases/PartialResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:49](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L49)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`T`

##### error

`any`

#### Returns

[`PartialResultType`](/reference/api/core/src/type-aliases/PartialResultType)\<`T`\>
