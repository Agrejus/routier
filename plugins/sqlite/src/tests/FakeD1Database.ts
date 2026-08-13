import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from '../d1';

/**
 * A `D1Database` over `node:sqlite`, for exercising the batch write path in process.
 *
 * ## What this proves, and what it cannot
 *
 * D1 is SQLite. The statements this plugin emits are the same ones the `node:sqlite` driver
 * runs and are already covered against a real engine, so what is genuinely new in the D1
 * plugin is the SHAPE of execution: everything up front, one transaction, results returned
 * positionally. That is what this double is built to test, and the properties below are
 * implemented rather than stubbed:
 *
 *  - `batch` wraps the statements in `BEGIN IMMEDIATE` / `COMMIT`, and rolls back on the first
 *    failure. A double that just ran them in a loop would let the plugin's atomicity claim
 *    pass while being false.
 *  - Results come back one per statement, in order, so a positional mis-alignment fails here.
 *  - `bind` returns a NEW statement rather than mutating, matching D1, so a plugin that reused
 *    a prepared statement across parameter sets would be caught.
 *
 * What it cannot prove is anything about D1 the service: that `batch` really is one
 * transaction on Cloudflare's side, how it reports a missing table, or its statement limits.
 * Those are assumptions this file encodes rather than checks — the same caveat the Turso
 * driver carries for running over a local `file:` URL. Recorded in `specs/plugin-roadmap.md`.
 */
export class FakeD1Database implements D1Database {

    private readonly database: DatabaseSync;
    /** Statements seen, in order, for tests that assert what was sent rather than the result. */
    readonly executed: string[] = [];
    /** Batches seen, as statement counts, so a test can prove the creates were prepended. */
    readonly batches: number[] = [];

    constructor(path: string = ':memory:') {
        this.database = new DatabaseSync(path);
    }

    prepare(sql: string): D1PreparedStatement {
        return this.createStatement(sql, []);
    }

    private createStatement(sql: string, params: readonly unknown[]): D1PreparedStatement {
        const owner = this;

        return {
            bind(...values: unknown[]) {
                // A new statement, not a mutation of this one — D1's `bind` is immutable, and
                // a plugin relying on the other behaviour would silently reuse parameters.
                return owner.createStatement(sql, values);
            },
            async all<T = unknown>() {
                return { results: owner.run(sql, params) as T[] };
            },
        };
    }

    /** Runs one statement, recording it. Rows come back for everything, including RETURNING. */
    private run(sql: string, params: readonly unknown[]): unknown[] {
        this.executed.push(sql);

        const bindable = params.map(value => (value === undefined ? null : value)) as never[];

        return this.database.prepare(sql).all(...bindable);
    }

    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]> {
        this.batches.push(statements.length);

        // IMMEDIATE rather than DEFERRED, matching what the SQLite plugin uses: the write lock
        // is taken at the start, so a busy database fails here rather than part way through.
        this.database.exec('BEGIN IMMEDIATE TRANSACTION');

        const results: { results: T[] }[] = [];

        try {
            for (const statement of statements) {
                results.push(await statement.all<T>());
            }

            this.database.exec('COMMIT');
        } catch (error) {
            // Must not replace the error that caused it, or a failed rollback hides the cause.
            try {
                this.database.exec('ROLLBACK');
            } catch {
                // Already rolled back by the engine.
            }

            throw error;
        }

        return results;
    }

    /** Row count for a table, for asserting that a rolled-back batch left nothing behind. */
    count(table: string): number {
        const [row] = this.database.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).all() as { c: number }[];

        return row.c;
    }

    close(): void {
        this.database.close();
    }
}
