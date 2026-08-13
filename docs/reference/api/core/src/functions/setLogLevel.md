[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / setLogLevel

# Function: setLogLevel()

> **setLogLevel**(`next`): `void`

Defined in: [core/src/utilities/logger.ts:101](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/utilities/logger.ts#L101)

Overrides the level for the rest of the process.

The configuration above is read once, at import, which is what makes the gate cheap — but it
also means an application that decides its verbosity after startup, or a test that wants to
assert on output, has no way in. This is that way in.

## Parameters

### next

`"error"` | `"silent"` | `"warn"` | `"info"` | `"debug"`

## Returns

`void`
