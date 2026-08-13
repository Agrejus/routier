# Shared SQL translation

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

The SQL knowledge every SQL plugin shares: dialects, WHERE generation, column assignment, update batching.

## Rules

- A dialect states what genuinely differs between engines — quoting, placeholders, LIKE versus GLOB, JSON column type and extraction, date literals. Stated once, so DDL and queries cannot drift apart.
- Every SQL plugin delegates here rather than reimplementing. A local expressionToWhereClause should be a one-line call to toSql, as SQLite's and PostgreSQL's are.
- A nested subtree is ONE JSON column named for its root. Filtering into it is a path, not a column — see jsonPathExpression.
- Shape assertions prove what the builder emits, not what an engine does with it. A change here needs e2e/src/dialectConformance.ts run against real engines, because SQLite forgives what PostgreSQL and MySQL do not.

## May import

`@routier/core`

## Covers

- `plugins/sql-core`
