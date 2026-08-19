[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / StringOptions

# Type Alias: StringOptions

> **StringOptions** = `object`

Defined in: [core/src/schema/types.ts:95](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L95)

What `s.string({ ... })` accepts.

Declarations only. Core stores them and never acts on them; a backend that can use one does.

## Properties

### maxLength?

> `optional` **maxLength**: `number`

Defined in: [core/src/schema/types.ts:103](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L103)

The longest value the property is declared to hold.

MySQL uses it for `VARCHAR(maxLength)`; without it every string column is
`VARCHAR(255)`, which silently truncates longer values. Other backends ignore it. Core
never validates a value against it — see `SchemaBase.maxLength`.
