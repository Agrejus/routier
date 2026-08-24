import { RECOVERABLE_SQLSTATE, type PostgresConnection, type PostgresDriver } from '@routier/postgres-plugin-core';

/**
 * The part of PGlite this driver uses.
 *
 * Structural rather than an import of PGlite's own type, so that `PGlite` and `PGliteWorker`
 * both satisfy it and neither entry point has to depend on the other's module.
 */
export interface PGliteLike {
    query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
    exec(sql: string): Promise<unknown>;
    close(): Promise<void>;
}

/**
 * `undefined` is not a value PGlite can bind. An optional property that was never set reaches
 * the driver as `undefined` and has to become SQL NULL, which is what `pg` did with it too.
 */
const normalizeParams = (params?: readonly unknown[]): unknown[] =>
    (params ?? []).map(value => (value === undefined ? null : value));

/**
 * Puts the SQLSTATE back on an error that lost it crossing `postMessage`.
 *
 * `PGliteWorker` rebuilds a failure on the main thread as `new Error(error.message)` — the
 * message survives and every other field, `code` included, does not. The plugin decides
 * whether a table has to be created by reading `code`, so without this a first write to a new
 * collection fails instead of creating the table, and only in the browser.
 *
 * Matching on message text is what the shared plugin deliberately avoids, because a server
 * translates its messages under `lc_messages`. It is safe HERE and only here: PGlite is a
 * fixed build running in the C locale, so these strings cannot vary.
 */
const RESTORED_CODES: readonly [RegExp, string][] = [
    [/relation ".*" does not exist/, RECOVERABLE_SQLSTATE.undefinedTable],
    [/relation ".*" already exists/, RECOVERABLE_SQLSTATE.duplicateTable],
    [/duplicate key value violates unique constraint/, RECOVERABLE_SQLSTATE.uniqueViolation],
];

const withSqlState = (error: unknown): unknown => {
    const failure = error as { code?: unknown, message?: unknown } | null;

    if (failure == null || failure.code != null || typeof failure.message !== 'string') {
        return error;
    }

    const message = failure.message;
    const matched = RESTORED_CODES.find(([pattern]) => pattern.test(message));

    if (matched != null) {
        failure.code = matched[1];
    }

    return error;
};

class PGliteConnection implements PostgresConnection {

    constructor(private readonly database: PGliteLike, private readonly onRelease: () => void) { }

    async all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        try {
            const result = await this.database.query(sql, normalizeParams(params));

            return result.rows;
        } catch (error) {
            throw withSqlState(error);
        }
    }

    run(sql: string, params?: readonly unknown[]): Promise<void> {
        return this.execute(sql, params).catch(error => { throw withSqlState(error); });
    }

    private async execute(sql: string, params?: readonly unknown[]): Promise<void> {
        // `exec` for a statement with no parameters, because it is the only one of the two
        // that accepts DDL PGlite splits into several commands — `compiledSchemaToPostgresTable`
        // emits a CREATE TABLE followed by its CREATE INDEX statements.
        if (params == null || params.length === 0) {
            await this.database.exec(sql);
            return;
        }

        await this.database.query(sql, normalizeParams(params));
    }

    async release(): Promise<void> {
        this.onRelease();
    }
}

export type PGliteDriverOptions = {
    /** Names the engine in errors. Distinguishes the worker-backed driver from the direct one. */
    name?: string;
};

/**
 * PGlite behind the `PostgresDriver` interface.
 *
 * **`connect` is serialised, because PGlite is one connection.** The plugin runs a save as
 * `BEGIN`, several statements, `COMMIT`; a query arriving on the same connection mid-save
 * would execute inside that transaction, and a second save's `BEGIN` would be an error. So
 * each caller waits for the previous one to release. This is a fact about this engine, kept
 * out of the shared plugin — `pg` has a pool and pays nothing for it.
 *
 * A chained promise rather than a lock: the next caller starts when the previous one settles,
 * whichever way it went, so one failure cannot stall the rest. Sequential callers pay nothing,
 * because the chain is already resolved.
 *
 * `database` is a promise so that a caller can construct the plugin synchronously while PGlite
 * is still starting. The first operation awaits it.
 */
export const pgliteDriver = (
    databaseName: string,
    database: Promise<PGliteLike>,
    options: PGliteDriverOptions = {}
): PostgresDriver => {
    let queue: Promise<unknown> = Promise.resolve();

    return {
        name: options.name ?? 'pglite',
        databaseName,

        async connect(): Promise<PostgresConnection> {
            let release!: () => void;
            const held = new Promise<void>(resolve => { release = resolve; });
            const ourTurn = queue.then((): void => undefined, (): void => undefined);

            queue = ourTurn.then(() => held);

            await ourTurn;

            try {
                return new PGliteConnection(await database, release);
            } catch (error) {
                // The connection never existed, so nothing will ever release it. Without this
                // the queue is blocked forever on a database that failed to start.
                release();
                throw error;
            }
        },

        async dispose(): Promise<void> {
            await (await database).close();
        },
    };
};
