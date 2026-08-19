[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / WorkPipeline

# Class: WorkPipeline

Defined in: [core/src/pipeline/TrampolinePipeline.ts:182](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/pipeline/TrampolinePipeline.ts#L182)

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

Defined in: [core/src/pipeline/TrampolinePipeline.ts:186](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/pipeline/TrampolinePipeline.ts#L186)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### pipe()

> **pipe**(`work`): `void`

Defined in: [core/src/pipeline/TrampolinePipeline.ts:312](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/pipeline/TrampolinePipeline.ts#L312)

#### Parameters

##### work

[`UnitOfWork`](../type-aliases/UnitOfWork.md)

#### Returns

`void`
