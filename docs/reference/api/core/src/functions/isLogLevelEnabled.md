[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / isLogLevelEnabled

# Function: isLogLevelEnabled()

> **isLogLevelEnabled**(`at`): `boolean`

Defined in: [core/src/utilities/logger.ts:125](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/utilities/logger.ts#L125)

Whether a message at this level would be emitted.

For the rare call site whose *arguments* are expensive to build — a serialization, a deep
clone, a join over a large collection. An ordinary payload object is not worth guarding; see
the measurement in the header.

## Parameters

### at

`"error"` | `"silent"` | `"warn"` | `"info"` | `"debug"`

## Returns

`boolean`
