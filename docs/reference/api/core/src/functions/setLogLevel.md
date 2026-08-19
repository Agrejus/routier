[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / setLogLevel

# Function: setLogLevel()

> **setLogLevel**(`next`): `void`

Defined in: [core/src/utilities/logger.ts:101](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/utilities/logger.ts#L101)

Overrides the level for the rest of the process.

The configuration above is read once, at import, which is what makes the gate cheap — but it
also means an application that decides its verbosity after startup, or a test that wants to
assert on output, has no way in. This is that way in.

## Parameters

### next

`"error"` | `"silent"` | `"warn"` | `"info"` | `"debug"`

## Returns

`void`
