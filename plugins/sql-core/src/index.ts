/**
 * Shared building blocks for the SQL plugins.
 *
 * This package exists to keep `@routier/core` storage-agnostic. Dialect quoting rules,
 * placeholder syntax, `LIKE` versus `GLOB`, and the row-shaped result conventions of a SQL
 * driver are not facts about Routier's data model — they are facts about particular
 * databases, and core has no business knowing them.
 *
 * It is equally not something to copy into each SQL plugin: the dialect table is one
 * mechanism with four configurations, and three divergent copies of it is how the same bug
 * gets fixed once and shipped broken twice.
 *
 * Consumed by `@routier/sqlite-plugin`, `@routier/postgresql-plugin`, and
 * `@routier/mysql-plugin`. Anything here may name a specific engine; nothing in
 * `@routier/core` may.
 *
 * Note what is NOT here. `SqlTranslator` stays in core: it describes how *aggregate results
 * arrive as rows*, which is a shape convention rather than engine knowledge, and it names no
 * engine. A driver that deviates overrides it in its own plugin — see
 * `PostgresSqlTranslator`, which handles `pg` returning COUNT(*) as a string.
 */
export * from './sql';
export * from './columns';
export * from './updates';
export * from './joins';
