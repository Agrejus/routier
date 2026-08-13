[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / PluginEventResult

# Class: PluginEventResult

Defined in: [core/src/results/Result.ts:58](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L58)

## Extends

- `BaseResult`

## Constructors

### Constructor

> **new PluginEventResult**(): `PluginEventResult`

#### Returns

`PluginEventResult`

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

### success()

#### Call Signature

> `static` **success**\<`T`\>(`id`, `data`): [`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:59](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L59)

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`string`

###### data

`T`

##### Returns

[`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`T`\>

#### Call Signature

> `static` **success**\<`T`\>(`id`): [`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`never`\>

Defined in: [core/src/results/Result.ts:60](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L60)

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`string`

##### Returns

[`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`never`\>

***

### error()

> `static` **error**\<`T`\>(`id`, `error`): [`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:69](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L69)

#### Type Parameters

##### T

`T`

#### Parameters

##### id

`string`

##### error

`any`

#### Returns

[`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`T`\>

***

### partial()

> `static` **partial**\<`T`\>(`id`, `data`, `error`): [`PluginEventPartialResultType`](/reference/api/core/src/type-aliases/PluginEventPartialResultType)\<`T`\>

Defined in: [core/src/results/Result.ts:77](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L77)

#### Type Parameters

##### T

`T`

#### Parameters

##### id

`string`

##### data

`T`

##### error

`any`

#### Returns

[`PluginEventPartialResultType`](/reference/api/core/src/type-aliases/PluginEventPartialResultType)\<`T`\>

***

### assertSuccess()

> `static` **assertSuccess**\<`T`\>(`result`): `asserts result is { ok: "success"; data: T; id: string }`

Defined in: [core/src/results/Result.ts:86](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/results/Result.ts#L86)

#### Type Parameters

##### T

`T`

#### Parameters

##### result

[`PluginEventResultType`](/reference/api/core/src/type-aliases/PluginEventResultType)\<`T`\>

#### Returns

`asserts result is { ok: "success"; data: T; id: string }`

#### Overrides

`BaseResult.assertSuccess`
