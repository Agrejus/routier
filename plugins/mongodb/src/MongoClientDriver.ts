import { MongoCollection, MongoDriver, MongoFindOptions, MongoScope, MongoUpdate } from "./driver";
import { MqlFilter } from "./mql";

/**
 * A driver over the official `mongodb` client.
 *
 * The client is passed in rather than constructed here, and its types are described
 * structurally below rather than imported. That keeps `mongodb` out of this package's
 * dependencies entirely: the caller already has a version of it, connection and pool
 * settings are theirs to own, and this package does not get to pin a major version for them.
 *
 * ```ts
 * import { MongoClient } from 'mongodb';
 *
 * const client = new MongoClient('mongodb://localhost:27017/?replicaSet=rs0');
 * await client.connect();
 *
 * const plugin = new MongoDbPlugin(
 *     new MongoClientDriver(client, 'my-app', { transactions: 'required' })
 * );
 * ```
 */

// --- The parts of the `mongodb` client this uses, described structurally ------------------

type NativeCursor = { toArray(): Promise<Record<string, unknown>[]> };

type NativeCollection = {
    find(filter: unknown, options?: unknown): NativeCursor;
    insertMany(documents: unknown[], options?: unknown): Promise<unknown>;
    updateOne(filter: unknown, update: unknown, options?: unknown): Promise<{ matchedCount: number }>;
    deleteMany(filter: unknown, options?: unknown): Promise<unknown>;
};

type NativeDb = {
    collection(name: string): NativeCollection;
    dropDatabase(): Promise<unknown>;
};

type NativeSession = {
    startTransaction(): void;
    commitTransaction(): Promise<unknown>;
    abortTransaction(): Promise<unknown>;
    endSession(): Promise<void>;
};

export type MongoClientLike = {
    db(name?: string): NativeDb;
    startSession(): NativeSession;
    close(): Promise<void>;
};

export type MongoClientDriverOptions = {
    /**
     * Whether this deployment can do transactions.
     *
     * MongoDB transactions need a replica set. A standalone `mongod` — what most people run
     * locally — rejects them outright, so this cannot be assumed and must not be discovered
     * on the first multi-collection save.
     *
     * - `"required"` opens a session and commits. A deployment that cannot support it fails
     *   the save with Mongo's own error, which names the cause.
     * - `"unavailable"` runs each save without a session. Writes are applied in order and
     *   reported, but a failure part way through leaves the earlier ones in place.
     *
     * There is no `"auto"`. Detecting it would mean a store silently losing atomicity when
     * it moved from a replica set to a standalone, which is precisely the thing worth
     * knowing about.
     */
    readonly transactions: "required" | "unavailable";
};

export class MongoClientDriver implements MongoDriver {

    readonly name = "mongodb";

    private readonly client: MongoClientLike;
    private readonly databaseName: string | undefined;
    private readonly options: MongoClientDriverOptions;

    constructor(client: MongoClientLike, databaseName?: string, options?: MongoClientDriverOptions) {
        this.client = client;
        this.databaseName = databaseName;
        this.options = options ?? { transactions: "required" };
    }

    private get db(): NativeDb {
        return this.client.db(this.databaseName);
    }

    async collection(name: string): Promise<MongoCollection> {
        return wrap(this.db.collection(name), undefined);
    }

    async transaction<T>(work: (scope: MongoScope) => Promise<T>): Promise<T> {
        if (this.options.transactions === "unavailable") {
            return work({ collection: name => this.collection(name) });
        }

        const session = this.client.startSession();

        /**
         * An explicit transaction rather than `withTransaction`.
         *
         * `withTransaction` is the convenient API and it RETRIES — on a transient error and on
         * a commit conflict — which would make this the only plugin in the repository that
         * silently repeats a save. SQLite issues `BEGIN IMMEDIATE` and lets `SQLITE_BUSY`
         * abort the save; the same code has to fail the same way on every backend, so a
         * conflict surfaces to the caller here too.
         *
         * The consequence that matters above: `work` runs exactly once, so nothing outside
         * this driver needs to know anything about transaction mechanics.
         */
        session.startTransaction();

        try {
            const value = await work({
                collection: async name => wrap(this.db.collection(name), session),
            });

            await session.commitTransaction();

            return value;
        } catch (error) {
            // The abort must not replace the error that caused it — a failed abort on an
            // already-aborted transaction would otherwise hide the real cause.
            await session.abortTransaction().catch((): void => undefined);

            throw error;
        } finally {
            await session.endSession();
        }
    }

    async dropDatabase(): Promise<void> {
        await this.db.dropDatabase();
    }

    async close(): Promise<void> {
        await this.client.close();
    }
}

/**
 * Binds a native collection to a session, if there is one.
 *
 * Every call passes `{ session }`. Missing it on ONE of them is the characteristic bug: that
 * operation runs outside the transaction, commits on its own, and is not rolled back with
 * the rest — while the call site looks exactly like the others.
 */
function wrap(collection: NativeCollection, session: NativeSession | undefined): MongoCollection {
    const withSession = <T extends object>(options?: T) =>
        session == null ? options : { ...(options ?? {} as T), session };

    return {
        find(filter: MqlFilter, options?: MongoFindOptions) {
            return collection.find(filter, withSession(options)).toArray();
        },

        async insertMany(documents: Record<string, unknown>[]) {
            await collection.insertMany(documents, withSession());
        },

        async updateMany(updates: readonly MongoUpdate[]) {
            const matched: number[] = [];

            // One `updateOne` per update rather than `bulkWrite`, because the plugin needs
            // each update's matched count SEPARATELY to name which rows lost a concurrency
            // race. A bulk write reports a total, which cannot say which one it was.
            for (const update of updates) {
                const result = await collection.updateOne(
                    update.filter,
                    { $set: update.set },
                    withSession()
                );

                matched.push(result.matchedCount);
            }

            return matched;
        },

        async deleteMany(filter: MqlFilter) {
            await collection.deleteMany(filter, withSession());
        },
    };
}
