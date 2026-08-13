[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TrampolinePipeline

# Class: TrampolinePipeline\<TInitial, TCurrent\>

Defined in: [core/src/pipeline/TrampolinePipeline.ts:15](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/pipeline/TrampolinePipeline.ts#L15)

## Type Parameters

### TInitial

`TInitial`

### TCurrent

`TCurrent` = `TInitial`

## Constructors

### Constructor

> **new TrampolinePipeline**\<`TInitial`, `TCurrent`\>(): `TrampolinePipeline`\<`TInitial`, `TCurrent`\>

#### Returns

`TrampolinePipeline`\<`TInitial`, `TCurrent`\>

## Methods

### filter()

> **filter**\<`TFinal`\>(`initialData`, `done`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/pipeline/TrampolinePipeline.ts#L19)

#### Type Parameters

##### TFinal

`TFinal`

#### Parameters

##### initialData

`TInitial`

##### done

(`data`, `error?`) => `void`

#### Returns

`void`

***

### pipe()

> **pipe**\<`TNext`\>(`processor`): `TrampolinePipeline`\<`TInitial`, `TNext`\>

Defined in: [core/src/pipeline/TrampolinePipeline.ts:157](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/pipeline/TrampolinePipeline.ts#L157)

#### Type Parameters

##### TNext

`TNext`

#### Parameters

##### processor

[`Processor`](../type-aliases/Processor.md)\<`TCurrent`, `TNext`\>

#### Returns

`TrampolinePipeline`\<`TInitial`, `TNext`\>

***

### pipeEach()

> **pipeEach**(`items`, `fn`, `map`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:162](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/pipeline/TrampolinePipeline.ts#L162)

#### Parameters

##### items

`TCurrent`[]

##### fn

(`payload`, `done`) => `void`

##### map

(`previous`, `current`) => [`ResultType`](../type-aliases/ResultType.md)\<`TCurrent`\>

#### Returns

`void`
