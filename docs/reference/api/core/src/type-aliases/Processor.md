[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Processor

# Type Alias: Processor()\<TIn, TOut\>

> **Processor**\<`TIn`, `TOut`\> = (`data`, `callback`) => `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/pipeline/TrampolinePipeline.ts#L9)

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
