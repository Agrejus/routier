[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / isJsonColumn

# Function: isJsonColumn()

> **isJsonColumn**(`property`): `boolean`

Defined in: [plugins/sql-core/src/columns.ts:67](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/columns.ts#L67)

True when the property's value is encoded as JSON rather than bound as a scalar.

A vector belongs here even on an engine that gives it a native column type. The encoding
`JSON.stringify` produces for a list of numbers — `[1,2,3]` — is byte for byte the text
literal pgvector accepts, so one encode path serves both, and the DDL is the only place the
two engines differ. Reading is the same story in reverse: a JSON column comes back as that
text, and so does a pgvector column through a driver with no type parser registered for it.

## Parameters

### property

`PropertyInfo`\<`any`\>

## Returns

`boolean`
