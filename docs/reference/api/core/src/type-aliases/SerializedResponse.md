[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SerializedResponse

# Type Alias: SerializedResponse

> **SerializedResponse** = \{ `ok`: `true`; `kind`: `"query"`; `value`: `unknown`; \} \| \{ `ok`: `true`; `kind`: `"persist"`; `changes`: `object`[]; \} \| \{ `ok`: `true`; `kind`: `"destroy"`; \} \| \{ `ok`: `false`; `error`: `string`; \}

Defined in: [core/src/plugins/wire/types.ts:88](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/wire/types.ts#L88)

What a receiver sends back. Errors are a value, not a transport status.
