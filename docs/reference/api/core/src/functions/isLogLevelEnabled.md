[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / isLogLevelEnabled

# Function: isLogLevelEnabled()

> **isLogLevelEnabled**(`at`): `boolean`

Defined in: [core/src/utilities/logger.ts:125](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/utilities/logger.ts#L125)

Whether a message at this level would be emitted.

For the rare call site whose *arguments* are expensive to build — a serialization, a deep
clone, a join over a large collection. An ordinary payload object is not worth guarding; see
the measurement in the header.

## Parameters

### at

`"error"` | `"silent"` | `"warn"` | `"info"` | `"debug"`

## Returns

`boolean`
