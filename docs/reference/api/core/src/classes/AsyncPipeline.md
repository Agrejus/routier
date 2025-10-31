[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / AsyncPipeline

# Class: AsyncPipeline\<TData, TResult\>

Defined in: [core/src/pipeline/TrampolinePipeline.ts:160](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L160)

## Type Parameters

### TData

`TData`

### TResult

`TResult`

## Constructors

### Constructor

> **new AsyncPipeline**\<`TData`, `TResult`\>(): `AsyncPipeline`\<`TData`, `TResult`\>

#### Returns

`AsyncPipeline`\<`TData`, `TResult`\>

## Methods

### filter()

> **filter**(`done`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:164](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L164)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`TResult`[]\>

#### Returns

`void`

***

### pipe()

> **pipe**(`data`, `processor`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:288](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L288)

#### Parameters

##### data

`TData`

##### processor

[`AsyncUnitOfWork`](../type-aliases/AsyncUnitOfWork.md)\<`TData`, `TResult`\>

#### Returns

`void`

***

### pipeEach()

> **pipeEach**(`items`, `processor`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:292](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L292)

#### Parameters

##### items

`TData`[]

##### processor

[`AsyncUnitOfWork`](../type-aliases/AsyncUnitOfWork.md)\<`TData`, `TResult`\>

#### Returns

`void`
