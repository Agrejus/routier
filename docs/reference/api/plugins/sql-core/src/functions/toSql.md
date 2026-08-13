[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / toSql

# Function: toSql()

> **toSql**(`expr`, `dialect`, `options?`): [`ToSqlResult`](../interfaces/ToSqlResult.md)

Defined in: [plugins/sql-core/src/sql.ts:618](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/sql.ts#L618)

Converts an Expression to a SQL WHERE clause and bound parameters for the given dialect.

## Parameters

### expr

`Expression`

### dialect

[`SqlDialectName`](../type-aliases/SqlDialectName.md) | [`SqlDialect`](../interfaces/SqlDialect.md)

### options?

[`ToSqlOptions`](../type-aliases/ToSqlOptions.md)

## Returns

[`ToSqlResult`](../interfaces/ToSqlResult.md)
