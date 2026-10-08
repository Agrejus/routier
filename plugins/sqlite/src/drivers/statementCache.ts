export const STATEMENT_CACHE_MAX = 64;

export class StatementCache<S> {
    private readonly statements = new Map<string, S>();

    constructor(
        private readonly prepare: (sql: string) => S,
        private readonly discard: (statement: S) => void,
    ) { }

    acquire(sql: string): S {
        const cached = this.statements.get(sql);

        if (cached !== undefined) {
            this.statements.delete(sql);
            this.statements.set(sql, cached);
            return cached;
        }

        const statement = this.prepare(sql);
        this.statements.set(sql, statement);

        if (this.statements.size > STATEMENT_CACHE_MAX) {
            this.evictLeastRecentlyUsed();
        }

        return statement;
    }

    forget(sql: string): void {
        this.statements.delete(sql);
    }

    private evictLeastRecentlyUsed(): void {
        const [[oldestSql, oldest]] = this.statements;
        this.statements.delete(oldestSql);
        this.discard(oldest);
    }
}
