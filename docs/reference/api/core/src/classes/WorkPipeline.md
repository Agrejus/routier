[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / WorkPipeline

# Class: WorkPipeline

Defined in: [core/src/pipeline/TrampolinePipeline.ts:308](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L308)

Processes functions with callbacks asynchronously.

This pipeline handles work items that contain callback functions,
executing them in an asynchronous manner while maintaining proper
flow control and error handling.

## Constructors

### Constructor

> **new WorkPipeline**(): `WorkPipeline`

#### Returns

`WorkPipeline`

## Methods

### filter()

> **filter**(`done`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:311](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L311)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### pipe()

> **pipe**(`work`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:405](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/pipeline/TrampolinePipeline.ts#L405)

#### Parameters

##### work

[`UnitOfWork`](../type-aliases/UnitOfWork.md)

#### Returns

`void`
