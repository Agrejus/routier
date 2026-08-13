import type { MqlFilter } from "./mql";

/**
 * The whole of what this plugin needs from MongoDB.
 *
 * Same reasoning as `SqliteDriver`: everything above this line — filter translation, id
 * resolution, change ordering — is already engine-independent, and only a handful of
 * operations ever touch a driver. Naming them in one small interface keeps the official
 * `mongodb` package out of this package's dependencies and makes the plugin testable
 * against a fake instead of a live server.
 */

/** How a query should be shaped by the server rather than in memory. */
export type MongoFindOptions = {
    readonly sort?: Readonly<Record<string, 1 | -1>>;
    readonly skip?: number;
    readonly limit?: number;
};

/** One update, already resolved to the document it targets. */
export type MongoUpdate = {
    /**
     * Selects the document, and for a schema with a concurrency token also carries the
     * expected value. A filter that matches nothing is how a lost race is detected — the
     * plugin turns it into an OptimisticConcurrencyError.
     */
    readonly filter: MqlFilter;
    /** The `$set` payload: what changed, in document terms. */
    readonly set: Record<string, unknown>;
};

export interface MongoCollection {
    find(filter: MqlFilter, options?: MongoFindOptions): Promise<Record<string, unknown>[]>;
    insertMany(documents: Record<string, unknown>[]): Promise<void>;
    /** Returns how many documents each update matched, in the order given. */
    updateMany(updates: readonly MongoUpdate[]): Promise<number[]>;
    deleteMany(filter: MqlFilter): Promise<void>;
}

/**
 * Collections bound to one atomic unit of work.
 *
 * A collection taken from here carries the session; one taken from the driver does not, and
 * would run outside the transaction while looking identical at the call site. That is the
 * easiest bug to write here, which is why the scope is a separate object rather than a flag.
 */
export interface MongoScope {
    collection(name: string): Promise<MongoCollection>;
}

export interface MongoDriver {
    /** Names the engine, for errors that would otherwise not say which one failed. */
    readonly name: string;
    collection(name: string): Promise<MongoCollection>;
    /**
     * Runs `work` exactly once, atomically, and returns what it returned.
     *
     * Exactly once is part of the contract, not an accident of the implementation. Mongo's
     * `withTransaction` helper retries on a transient error and on a commit conflict, and a
     * driver that used it would make this the only backend in the repository that silently
     * repeats a save — SQLite lets `SQLITE_BUSY` abort, and the same code has to fail the
     * same way everywhere. A driver retries nothing; a conflict reaches the caller.
     *
     * A driver whose engine cannot offer atomicity — a standalone `mongod` rejects
     * transactions outright — may run `work` with an unbound scope, but it has to say so when
     * it is constructed rather than at the first save.
     */
    transaction<T>(work: (scope: MongoScope) => Promise<T>): Promise<T>;
    /** Removes the database. Succeeds when it does not exist. */
    dropDatabase(): Promise<void>;
    close(): Promise<void>;
}
