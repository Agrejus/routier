[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / compiledSchemaToPostgresTable

# Function: compiledSchemaToPostgresTable()

> **compiledSchemaToPostgresTable**(`schema`, `tableName?`, `vectors?`): `string`

Defined in: plugins/postgres-core/dist/utils.d.ts:29

Converts a CompiledSchema to a PostgreSQL CREATE TABLE statement and index statements.

PostgreSQL-specific features:
- Uses SERIAL/BIGSERIAL for auto-incrementing integers
- Uses UUID extension for string identity keys
- Uses JSONB for nested objects/arrays
- Uses GIN indexes for JSONB columns

## Parameters

### schema

`CompiledSchema`\<`any`\>

### tableName?

`string`

### vectors?

[`PostgresVectorSupport`](../type-aliases/PostgresVectorSupport.md)

## Returns

`string`
