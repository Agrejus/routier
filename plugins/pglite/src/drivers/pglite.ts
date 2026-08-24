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

    /**
     * Deletes the storage, called inside `destroy` once the engine is closed and while the queue
     * turn is still held. Holding the turn is what keeps the delete from racing an operation
     * that is still in flight.
     *
     * Required of a driver that owns its storage, because the contract says destroy deletes.
     * Omitted only when the caller owns the engine — see `pgliteDbPlugin` — and then `destroy`
     * refuses rather than quietly keeping data it promised to remove.
     */
    deleteStorage?: () => Promise<void>;
};

/**
 * Where the engine comes from.
 *
 * A function means the driver owns the engine and may start it again after `dispose` — which is
 * what lets a store that shares a disposed engine carry on against a fresh one. An instance
 * means the caller owns it, so it is closed once and never restarted.
 */
export type PGliteSource = Promise<PGliteLike> | (() => Promise<PGliteLike>);

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
    source: PGliteSource,
    options: PGliteDriverOptions = {}
): PostgresDriver => {
    let queue: Promise<unknown> = Promise.resolve();
    const start = typeof source === 'function' ? source : null;
    let database: Promise<PGliteLike> | null = start == null ? (source as Promise<PGliteLike>) : null;

    /** Takes the next turn in the queue and returns the release for it. */
    const takeTurn = async (): Promise<() => void> => {
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        const ourTurn = queue.then((): void => undefined, (): void => undefined);

        queue = ourTurn.then(() => held);

        await ourTurn;

        return release;
    };

    return {
        name: options.name ?? 'pglite',
        databaseName,

        async connect(): Promise<PostgresConnection> {
            const release = await takeTurn();

            try {
                if (database == null) {
                    if (start == null) {
                        throw new Error(`${databaseName} was closed, and this driver does not own the engine to reopen it`);
                    }

                    database = start();
                }

                return new PGliteConnection(await database, release);
            } catch (error) {
                // A failed start must not be remembered, or every later caller inherits the
                // rejection for the life of the page.
                if (start != null) {
                    database = null;
                }

                // The connection never existed, so nothing will ever release it. Without this
                // the queue is blocked forever on a database that failed to start.
                release();
                throw error;
            }
        },

        /**
         * Closes the engine and deletes the storage, both inside one queue turn.
         *
         * Queued because an unqueued close lands in the middle of whatever operation is in
         * flight: a store sharing this engine would have its transaction closed underneath it,
         * and a delete would race the same operation. The plugin never holds a connection while
         * asking for another, so waiting here cannot deadlock.
         *
         * The engine is left cold rather than poisoned. A store that shares it and has not been
         * destroyed starts a fresh one on its next operation, over an empty database.
         */
        async destroy(): Promise<void> {
            const release = await takeTurn();

            try {
                const started = database;

                database = null;

                if (started != null) {
                    await (await started).close();
                }

                if (options.deleteStorage == null) {
                    throw new Error(
                        `${databaseName} was closed, but its data was not deleted: this driver was given an engine ` +
                        `it does not own, so it cannot know where the storage is or whether removing it is wanted. ` +
                        `Pass deleteStorage to pgliteDbPlugin if the caller knows.`
                    );
                }

                await options.deleteStorage();
            } finally {
                release();
            }
        },
    };
};
