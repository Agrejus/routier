[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / plugins/sql-core/src

# plugins/sql-core/src

## Interfaces

- [SqlDialect](interfaces/SqlDialect.md)
- [ToSqlResult](interfaces/ToSqlResult.md)

## Type Aliases

- [ColumnAssignment](type-aliases/ColumnAssignment.md)
- [SqlEtag](type-aliases/SqlEtag.md)
- [SqlJoinStatement](type-aliases/SqlJoinStatement.md)
- [SqlDialectName](type-aliases/SqlDialectName.md)
- [PlaceholderCursor](type-aliases/PlaceholderCursor.md)
- [ToSqlOptions](type-aliases/ToSqlOptions.md)
- [EntityUpdate](type-aliases/EntityUpdate.md)
- [KeyTuple](type-aliases/KeyTuple.md)
- [ConditionalUpdateOperation](type-aliases/ConditionalUpdateOperation.md)
- [GroupedUpdateOperation](type-aliases/GroupedUpdateOperation.md)

## Variables

- [CASING\_CALLS](variables/CASING_CALLS.md)
- [JOIN\_OUTER\_ALIAS](variables/JOIN_OUTER_ALIAS.md)
- [JOIN\_INNER\_ALIAS](variables/JOIN_INNER_ALIAS.md)

## Functions

- [reportUnrenderableFilters](functions/reportUnrenderableFilters.md)
- [reportUnrenderableSelectors](functions/reportUnrenderableSelectors.md)
- [executedMapFields](functions/executedMapFields.md)
- [joinToPushDown](functions/joinToPushDown.md)
- [holdsAnyCall](functions/holdsAnyCall.md)
- [reportDivergentCalls](functions/reportDivergentCalls.md)
- [casingWarning](functions/casingWarning.md)
- [sqlColumnProperties](functions/sqlColumnProperties.md)
- [isJsonColumn](functions/isJsonColumn.md)
- [toColumnAssignments](functions/toColumnAssignments.md)
- [toColumnValueMap](functions/toColumnValueMap.md)
- [decodeJsonColumns](functions/decodeJsonColumns.md)
- [propertyColumn](functions/propertyColumn.md)
- [referencedColumn](functions/referencedColumn.md)
- [selectExpression](functions/selectExpression.md)
- [selectList](functions/selectList.md)
- [columnList](functions/columnList.md)
- [sqlEtagOf](functions/sqlEtagOf.md)
- [withEtagValue](functions/withEtagValue.md)
- [etagIncrementClauses](functions/etagIncrementClauses.md)
- [buildJoinStatement](functions/buildJoinStatement.md)
- [canPushDownJoin](functions/canPushDownJoin.md)
- [splitJoinRows](functions/splitJoinRows.md)
- [entityResultColumns](functions/entityResultColumns.md)
- [getDialect](functions/getDialect.md)
- [canRenderInSql](functions/canRenderInSql.md)
- [toSql](functions/toSql.md)
- [buildConditionalUpdateOperations](functions/buildConditionalUpdateOperations.md)
- [buildGroupedUpdateOperations](functions/buildGroupedUpdateOperations.md)
