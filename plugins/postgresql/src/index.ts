export * from './PostgresDbPlugin';
export * from './drivers/pg';

/**
 * The dialect, DDL and translation moved to `@routier/postgres-plugin-core` when PGlite became
 * a second engine. Re-exported so `PostgresSqlTranslator`, `SqlOperation` and the rest stay
 * importable from here.
 */
export * from '@routier/postgres-plugin-core';
