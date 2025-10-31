[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TrampolinePipeline

# Class: TrampolinePipeline\<TInitial, TCurrent\>

Defined in: [core/src/pipeline/TrampolinePipeline.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L14)

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

Defined in: [core/src/pipeline/TrampolinePipeline.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L18)

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

Defined in: [core/src/pipeline/TrampolinePipeline.ts:143](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L143)

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

Defined in: [core/src/pipeline/TrampolinePipeline.ts:148](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L148)

#### Parameters

##### items

`TCurrent`[]

##### fn

(`payload`, `done`) => `void`

##### map

(`previous`, `current`) => [`ResultType`](../type-aliases/ResultType.md)\<`TCurrent`\>

#### Returns

`void`
