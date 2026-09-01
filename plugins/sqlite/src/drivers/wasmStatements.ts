import type { WasmStatement } from './wasmRows';

export type ReusableStatement = WasmStatement & { reset(): void; clearBindings(): void };

export type PreparingDatabase = { prepare(sql: string): WasmStatement };

export const STATEMENT_CACHE_MAX = 64;

const statementCaches = new WeakMap<PreparingDatabase, Map<string, ReusableStatement>>();

const markMostRecentlyUsed = (cache: Map<string, ReusableStatement>, sql: string, statement: ReusableStatement): ReusableStatement => {
    cache.delete(sql);
    cache.set(sql, statement);
    return statement;
};

const evictLeastRecentlyUsed = (cache: Map<string, ReusableStatement>): void => {
    const [oldestSql, oldest] = cache.entries().next().value as [string, ReusableStatement];
    cache.delete(oldestSql);
    oldest.finalize();
};

export const acquireStatement = (database: PreparingDatabase, sql: string): ReusableStatement => {
    let cache = statementCaches.get(database);

    if (cache == null) {
        cache = new Map();
        statementCaches.set(database, cache);
    }

    const cached = cache.get(sql);

    if (cached != null) {
        return markMostRecentlyUsed(cache, sql, cached);
    }

    const statement = database.prepare(sql) as ReusableStatement;
    cache.set(sql, statement);

    if (cache.size > STATEMENT_CACHE_MAX) {
        evictLeastRecentlyUsed(cache);
    }

    return statement;
};

const discardBrokenStatement = (database: PreparingDatabase, sql: string, statement: ReusableStatement): void => {
    statementCaches.get(database)?.delete(sql);
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
