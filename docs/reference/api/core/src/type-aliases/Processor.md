[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Processor

# Type Alias: Processor()\<TIn, TOut\>

> **Processor**\<`TIn`, `TOut`\> = (`data`, `callback`) => `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L8)

Type definition for an asynchronous function that takes data and a callback.
TIn: The input data type.
TOut: The output data type (passed to the callback).

## Type Parameters

### TIn

`TIn`

### TOut

`TOut`

## Parameters

### data

`TIn`

### callback

(`result`, `error?`) => `void`

## Returns

`void`
