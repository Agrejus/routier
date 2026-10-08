import { StatementCache } from './statementCache';
import type { WasmStatement } from './wasmRows';

export type ReusableStatement = WasmStatement & { reset(): void; clearBindings(): void };

export type PreparingDatabase = { prepare(sql: string): WasmStatement };

const statementCaches = new WeakMap<PreparingDatabase, StatementCache<ReusableStatement>>();

const cacheFor = (database: PreparingDatabase): StatementCache<ReusableStatement> => {
    let cache = statementCaches.get(database);

    if (cache == null) {
        cache = new StatementCache(sql => database.prepare(sql) as ReusableStatement, statement => statement.finalize());
        statementCaches.set(database, cache);
    }

    return cache;
};

export const acquireStatement = (database: PreparingDatabase, sql: string): ReusableStatement =>
    cacheFor(database).acquire(sql);

const discardBrokenStatement = (database: PreparingDatabase, sql: string, statement: ReusableStatement): void => {
    cacheFor(database).forget(sql);
    try {
        statement.finalize();
    } catch {
        return;
    }
};

export const releaseStatement = (database: PreparingDatabase, sql: string, statement: ReusableStatement): void => {
    try {
        statement.reset();
        statement.clearBindings();
    } catch (error) {
        discardBrokenStatement(database, sql, statement);
        throw error;
    }
};
