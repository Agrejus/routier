[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / AsyncPipeline

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

[`CallbackResult`](/reference/api/core/src/type-aliases/CallbackResult)\<`TResult`[]\>

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

[`AsyncUnitOfWork`](/reference/api/core/src/type-aliases/AsyncUnitOfWork)\<`TData`, `TResult`\>

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

[`AsyncUnitOfWork`](/reference/api/core/src/type-aliases/AsyncUnitOfWork)\<`TData`, `TResult`\>

#### Returns

`void`
