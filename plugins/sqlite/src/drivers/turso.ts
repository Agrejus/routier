import { normalizeParams, type SqliteConnection, type SqliteDriver } from './types';

/**
 * Turso and libSQL, over HTTP or over a local file.
 *
 * SQLite reached across a network, so `@routier/sql-plugin-core` already builds every
 * statement and this only has to move them. The client is passed in rather than constructed
 * here, and typed structurally, so `@libsql/client` stays out of this package's dependencies
 * and the caller owns their own connection and auth.
 *
 * ```ts
 * import { createClient } from '@libsql/client';
 *
 * const plugin = new SqliteDbPlugin('app', {
 *     driver: tursoDriver(createClient({ url: process.env.TURSO_URL, authToken: ... })),
 * });
 * ```
 *
 * ## Why this driver interprets BEGIN, COMMIT and ROLLBACK
 *
 * The plugin drives transactions the way every SQLite engine expects — it sends
 * `BEGIN IMMEDIATE TRANSACTION`, then its statements, then `COMMIT` or `ROLLBACK`, all through
 * `run`. That works because a local SQLite connection is stateful.
 *
 * **libSQL over HTTP is not.** Each `execute` is its own request, so a `BEGIN` sent that way
 * opens a transaction the following statements never join: the writes land outside it,
 * commit individually, and a `ROLLBACK` at the end undoes nothing. Nothing errors. The failure
 * is invisible until a save fails half way and leaves the database inconsistent.
 *
 * libSQL's answer is `client.transaction("write")`, which holds a stream for the duration. So
 * this driver recognises the three control statements and maps them onto that, and every other
 * statement is routed through the open transaction when there is one.
 *
 * The alternative is to give `SqliteDriver` explicit transaction methods and stop expressing
 * transactions as SQL at all — cleaner, and it would remove the string matching below. It
 * also changes the interface for the three existing drivers, so it is deliberately not
 * bundled with adding a backend. See the note in `specs/plugin-roadmap.md`.
 *
 * ## The caveat worth knowing before production
 *
 * An interactive transaction holds a write lock with a **5-second timeout**, and libSQL warns
 * that it degrades on high-latency or busy databases. A save is short, but a large one over a
 * slow link is a real failure mode — and a `file:` URL will never show it to you.
 */

// --- The parts of `@libsql/client` this uses, described structurally ----------------------

type LibsqlResult = { rows: unknown[] };

/**
 * `args` is `any[]` rather than `unknown[]` on purpose.
 *
 * libSQL types its parameters as a closed union (`InValue`: null, string, number, bigint,
 * boolean, Date, ArrayBuffer, Uint8Array). A structural shim declaring `unknown[]` is
 * STRICTER than the real client's signature, so the real client stops being assignable to it
 * — the shim would only accept a fake. The plugin hands down whatever the schema serialized,
 * which is `unknown` by the time it reaches here, so the looser type is what lets both the
 * real client and a test double satisfy this.
 */
type LibsqlStatement = { sql: string; args: any[] };

type LibsqlTransaction = {
    execute(statement: LibsqlStatement): Promise<LibsqlResult>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): void;
};

export type LibsqlClientLike = {
    execute(statement: LibsqlStatement): Promise<LibsqlResult>;
    transaction(mode: 'write' | 'read' | 'deferred'): Promise<LibsqlTransaction>;
    close(): void;
};

/**
 * Classifies a statement as transaction control.
 *
 * Anchored at the start and matched on the first word, so a statement that merely CONTAINS
 * the word — `INSERT INTO commits ...`, a string literal reading 'rollback' — is not mistaken
 * for one. `BEGIN` covers the plugin's `BEGIN IMMEDIATE TRANSACTION` and any other flavour.
 */
const BEGIN = /^\s*BEGIN\b/i;
const COMMIT = /^\s*COMMIT\b/i;
const ROLLBACK = /^\s*ROLLBACK\b/i;

class TursoConnection implements SqliteConnection {

    /** The open interactive transaction, if the plugin has begun one. */
    private transaction: LibsqlTransaction | null = null;

    constructor(private readonly client: LibsqlClientLike) { }

    async all(sql: string, params?: readonly unknown[]): Promise<unknown[]> {
        const result = await this.execute(sql, params);

        return result.rows;
    }

    async run(sql: string, params?: readonly unknown[]): Promise<void> {
        if (BEGIN.test(sql)) {
            if (this.transaction != null) {
                throw new Error(
                    'A transaction is already open on this libSQL connection. Nested ' +
                    'transactions are not supported; commit or roll the first one back.'
                );
            }

            // "write" rather than "deferred": the plugin sends BEGIN IMMEDIATE, which takes
            // the write lock up front. Deferring it would move a lock conflict from the BEGIN
            // to some later statement, which is the behaviour defect #32 was about.
            this.transaction = await this.client.transaction('write');
            return;
        }

        if (COMMIT.test(sql)) {
            const open = this.requireTransaction('COMMIT');
            this.transaction = null;

            await open.commit();
            return;
        }

        if (ROLLBACK.test(sql)) {
            // A rollback with nothing open is not an error. The plugin rolls back on the way
            // out of a failed save, and the failure may have been the BEGIN itself.
            const open = this.transaction;
            this.transaction = null;

            await open?.rollback();
            return;
        }

        await this.execute(sql, params);
    }

    private requireTransaction(statement: string): LibsqlTransaction {
        if (this.transaction == null) {
            throw new Error(`${statement} arrived with no open transaction on this libSQL connection.`);
        }

        return this.transaction;
    }

    /** Routed through the open transaction when there is one, so writes land inside it. */
    private execute(sql: string, params?: readonly unknown[]): Promise<LibsqlResult> {
        const statement = { sql, args: normalizeParams(params) };

        return (this.transaction ?? this.client).execute(statement);
    }

    async close(): Promise<void> {
        // An unfinished transaction is rolled back rather than left to time out. The plugin
        // closes on every path including failures, so this is where an aborted save releases
        // the write lock.
        if (this.transaction != null) {
            const open = this.transaction;
            this.transaction = null;

            await open.rollback().catch((): void => undefined);
        }

        // The CLIENT is not closed. It was passed in, it may be shared, and its lifetime
        // belongs to whoever created it — the plugin opens and closes a connection per
        // operation, which must not tear down the caller's client.
    }
}

export type TursoDriverOptions = {
    /**
     * What `destroy` does, which only the caller can know.
     *
     * A libSQL database is provisioned out of band — by the Turso CLI, the platform API, or
     * the file system — so there is no operation this driver could perform that is right for
     * every deployment. Dropping a remote database from inside an application is destructive
     * in a way it cannot scope, so the default REFUSES rather than guesses.
     *
     * A caller who knows what their URL points at supplies the teardown. For a local
     * `file:` database that is an unlink; for a disposable test database it might be a drop.
     */
    readonly deleteDatabase?: () => Promise<void>;
};

export const tursoDriver = (client: LibsqlClientLike, options?: TursoDriverOptions): SqliteDriver => ({
    name: 'turso',

    async open(_databaseName: string): Promise<SqliteConnection> {
        // The database is whichever one the client was pointed at. A name means nothing here:
        // libSQL addresses a database by URL, and ignoring the plugin's name openly is better
        // than pretending to honour it.
        return new TursoConnection(client);
    },

    async deleteDatabase(_databaseName: string): Promise<void> {
        if (options?.deleteDatabase != null) {
            await options.deleteDatabase();
            return;
        }

        throw new Error(
            'The Turso driver cannot delete a database on its own. A libSQL database is ' +
            'provisioned out of band — by the Turso CLI, the platform API, or the file ' +
            'system — and dropping one from inside an application would be a destructive ' +
            'operation this driver has no way to scope. Pass `deleteDatabase` to ' +
            '`tursoDriver` if a store of yours should be able to tear its database down.'
        );
    },
});
