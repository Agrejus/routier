/**
 * The whole of what this plugin needs from a PostgreSQL engine.
 *
 * Statement building, JSON column encoding and grouped updates are already engine-independent
 * and live in `utils.ts` and `@routier/sql-plugin-core`. Only connecting and running a
 * statement ever touched `pg` directly, so an engine fits in one small interface — and the
 * plugin then runs anywhere PostgreSQL runs, including WebAssembly in a browser.
 *
 * Transactions and savepoints are absent on purpose: every engine behind this interface is
 * PostgreSQL, so `BEGIN`, `SAVEPOINT` and `ROLLBACK TO SAVEPOINT` are ordinary statements the
 * plugin issues through `run`.
 */

/** One connection, held for the length of a single query or a single save. */
export interface PostgresConnection {
    /**
     * Runs a statement and returns its rows.
     *
     * Used for `SELECT` and for writes with `RETURNING`, which is how the plugin echoes saved
     * rows back to the change tracker.
     */
    all(sql: string, params?: readonly unknown[]): Promise<unknown[]>;

    /** Runs a statement whose rows are not wanted: DDL, `BEGIN`, `COMMIT`, `SAVEPOINT`. */
    run(sql: string, params?: readonly unknown[]): Promise<void>;

    /** Returns the connection to its driver. Called on every path, including failures. */
    release(): Promise<void>;
}

export interface PostgresDriver {
    /** Names the engine, for error messages that would otherwise not say which one failed. */
    readonly name: string;

    /**
     * See `IDbPlugin.databaseName`, whose contract this value satisfies on the plugin's behalf.
     *
     * Must identify the server and database, must be the same string for two instances over
     * one database, and must not contain credentials — it becomes part of a subscription
     * channel key.
     */
    readonly databaseName: string;

    /**
     * Takes a connection.
     *
     * A driver whose engine cannot run two transactions at once may delay this until the
     * previous connection is released; the plugin never holds one connection while asking for
     * another, so serialising here cannot deadlock.
     *
     * Must reject rather than throw synchronously. `pg` throws out of `pool.connect` once the
     * pool has ended, which lands past the caller as an unhandled exception.
     */
    connect(): Promise<PostgresConnection>;

    /**
     * Releases the engine: ends the pool, closes the instance.
     *
     * Does NOT delete data. `destroy` on a PostgreSQL plugin disconnects — dropping a database
     * is a separate and explicit act.
     */
    dispose(): Promise<void>;
}
