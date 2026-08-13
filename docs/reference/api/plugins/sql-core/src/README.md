[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / plugins/sql-core/src

# plugins/sql-core/src

## Interfaces

- [SqlDialect](interfaces/SqlDialect.md)
- [ToSqlResult](interfaces/ToSqlResult.md)

## Type Aliases

- [ColumnAssignment](type-aliases/ColumnAssignment.md)
- [SqlJoinStatement](type-aliases/SqlJoinStatement.md)
- [SqlDialectName](type-aliases/SqlDialectName.md)
- [ToSqlOptions](type-aliases/ToSqlOptions.md)
- [EntityUpdate](type-aliases/EntityUpdate.md)
- [KeyTuple](type-aliases/KeyTuple.md)
- [ConditionalUpdateOperation](type-aliases/ConditionalUpdateOperation.md)
- [GroupedUpdateOperation](type-aliases/GroupedUpdateOperation.md)

## Variables

- [JOIN\_OUTER\_ALIAS](variables/JOIN_OUTER_ALIAS.md)
- [JOIN\_INNER\_ALIAS](variables/JOIN_INNER_ALIAS.md)

## Functions

- [sqlColumnProperties](functions/sqlColumnProperties.md)
- [isJsonColumn](functions/isJsonColumn.md)
- [toColumnAssignments](functions/toColumnAssignments.md)
- [toColumnValueMap](functions/toColumnValueMap.md)
- [decodeJsonColumns](functions/decodeJsonColumns.md)
- [buildJoinStatement](functions/buildJoinStatement.md)
- [canPushDownJoin](functions/canPushDownJoin.md)
- [splitJoinRows](functions/splitJoinRows.md)
- [getDialect](functions/getDialect.md)
- [toSql](functions/toSql.md)
- [buildConditionalUpdateOperations](functions/buildConditionalUpdateOperations.md)
- [buildGroupedUpdateOperations](functions/buildGroupedUpdateOperations.md)
