/**
 * The whole of what this plugin needs from a SQLite engine.
 *
 * Everything above this line — statement building, JSON column encoding, grouped updates — is
 * already engine-independent and lives in `utils.ts` and `@routier/sql-plugin-core`. Only four
 * operations ever touched `sqlite3` directly, so an engine is describable in one small
 * interface, and the plugin can then run anywhere SQLite runs: Node, a browser, or a test
 * double.
 */

/** One open connection. The plugin opens one per operation and closes it on every path. */
export interface SqliteConnection {
    /**
     * Runs a statement and returns its rows.
     *
     * Used for `SELECT` and for writes with `RETURNING`, which is how the plugin echoes saved
     * rows back to the change tracker.
     */
    all(sql: string, params?: readonly unknown[]): Promise<unknown[]>;

    /** Runs a statement that returns nothing: DDL, `BEGIN`, `COMMIT`, `ROLLBACK`. */
    run(sql: string, params?: readonly unknown[]): Promise<void>;

    /** Releases the connection. Called on every completion path, including failures. */
    close(): Promise<void>;
}

export interface SqliteDriver {
    /** Names the engine, for error messages that would otherwise not say which one failed. */
    readonly name: string;

    /**
     * Opens `databaseName`.
     *
     * A failure to open must reject rather than throw asynchronously. The `sqlite3` driver
     * reported it by emitting `error` on the database object, which Node turned into an
     * uncaught exception that crashed the process and left the operation hanging — known
     * defect #34. Every driver here has to convert that into a rejected promise.
     */
    open(databaseName: string): Promise<SqliteConnection>;

    /**
     * Removes the database. Succeeds when it does not exist.
     *
     * What "remove" means is the engine's business: a file to unlink in Node, an OPFS entry
     * to delete in a browser.
     */
    deleteDatabase(databaseName: string): Promise<void>;
}

/**
 * Replaces `undefined` with `null` in a parameter list.
 *
 * `sqlite3` bound `undefined` as NULL. `node:sqlite` rejects it outright with "Provided value
 * cannot be bound to SQLite parameter", so a driver that passed parameters straight through
 * would turn a working save into an error for anyone whose entity has an optional property.
 * Normalising here keeps every driver bound to the behaviour the plugin already had.
 */
export const normalizeParams = (params?: readonly unknown[]): unknown[] =>
    (params ?? []).map(value => (value === undefined ? null : value));
