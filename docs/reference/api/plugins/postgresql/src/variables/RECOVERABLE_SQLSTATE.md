[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / RECOVERABLE\_SQLSTATE

# Variable: RECOVERABLE\_SQLSTATE

> `const` **RECOVERABLE\_SQLSTATE**: `object`

Defined in: plugins/postgres-core/dist/plugin.d.ts:11

The SQLSTATE codes this plugin recovers from, rather than message text, which is localised.

Exported because a driver whose transport drops the code has to put it back — see
`@routier/pglite-plugin`, where a worker rebuilds the error from its message alone.

## Type Declaration

### undefinedTable

> `readonly` **undefinedTable**: `"42P01"`

### duplicateTable

> `readonly` **duplicateTable**: `"42P07"`

### uniqueViolation

> `readonly` **uniqueViolation**: `"23505"`
