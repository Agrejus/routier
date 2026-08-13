import { MongoCollection, MongoDriver, MongoFindOptions, MongoScope, MongoUpdate } from "../driver";
import { MqlFilter } from "../mql";

/**
 * An in-process stand-in for MongoDB.
 *
 * It answers the small MQL subset the plugin emits, which is enough to pin the plugin's own
 * behaviour — ordering of removes/updates/adds, identity assignment, conflict detection,
 * what is pushed down — without a server.
 *
 * It is NOT evidence that the emitted MQL is correct. That is what the run against a real
 * MongoDB is for, in exactly the way `dialectConformance.ts` argues about SQL: a fake agrees
 * with whatever the code under test believes, and both can be wrong together.
 */
export class FakeMongoCollection implements MongoCollection {

    documents: Record<string, unknown>[] = [];

    async find(filter: MqlFilter, options?: MongoFindOptions): Promise<Record<string, unknown>[]> {
        let rows = this.documents.filter(document => matches(document, filter));

        if (options?.sort != null) {
            const keys = Object.entries(options.sort);

            rows = [...rows].sort((left, right) => {
                for (const [key, direction] of keys) {
                    const a = left[key] as never;
                    const b = right[key] as never;

                    if (a < b) return -1 * direction;
                    if (a > b) return 1 * direction;
                }

                return 0;
            });
        }

        if (options?.skip != null) {
            rows = rows.slice(options.skip);
        }

        if (options?.limit != null) {
            rows = rows.slice(0, options.limit);
        }

        return rows.map(row => structuredClone(row));
    }

    async insertMany(documents: Record<string, unknown>[]): Promise<void> {
        this.documents.push(...documents.map(document => structuredClone(document)));
    }

    async updateMany(updates: readonly MongoUpdate[]): Promise<number[]> {
        return updates.map(update => {
            const target = this.documents.find(document => matches(document, update.filter));

            if (target == null) {
                return 0;
            }

            for (const [path, value] of Object.entries(update.set)) {
                assignPath(target, path, value);
            }

            return 1;
        });
    }

    async deleteMany(filter: MqlFilter): Promise<void> {
        this.documents = this.documents.filter(document => matches(document, filter) === false);
    }
}

export class FakeMongoDriver implements MongoDriver {

    readonly name = "fake-mongo";
    readonly collections = new Map<string, FakeMongoCollection>();
    closed = false;

    /**
     * How many times the last `transaction` call ran its callback.
     *
     * Asserted to be 1. Mongo's `withTransaction` helper retries, and a driver that reached
     * for it would make this the only backend that silently repeats a save — so the count is
     * pinned rather than assumed.
     */
    attempts = 0;

    async collection(name: string): Promise<MongoCollection> {
        const existing = this.collections.get(name);

        if (existing != null) {
            return existing;
        }

        const created = new FakeMongoCollection();
        this.collections.set(name, created);

        return created;
    }

    /**
     * Atomic, by snapshot and restore.
     *
     * Crude next to a real transaction, and enough to hold the one property that matters:
     * either every write inside `work` is visible afterwards, or none is.
     */
    async transaction<T>(work: (scope: MongoScope) => Promise<T>): Promise<T> {
        const snapshot = new Map(
            [...this.collections].map(([name, collection]) =>
                [name, structuredClone(collection.documents)] as const
            )
        );

        const restore = () => {
            for (const [name, documents] of snapshot) {
                this.collections.get(name)!.documents = documents;
            }

            // A collection first created inside an aborted transaction never existed.
            // Collected before deleting rather than deleted while iterating.
            const created = [...this.collections.keys()].filter(name => snapshot.has(name) === false);

            for (const name of created) {
                this.collections.delete(name);
            }
        };

        this.attempts = 1;

        try {
            return await work({ collection: name => this.collection(name) });
        } catch (error) {
            restore();
            throw error;
        }
    }

    async dropDatabase(): Promise<void> {
        this.collections.clear();
    }

    async close(): Promise<void> {
        this.closed = true;
    }
}

/** Reads a dotted path, the way Mongo addresses a nested field. */
function readPath(document: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>(
        (current, segment) =>
            current == null || typeof current !== "object"
                ? undefined
                : (current as Record<string, unknown>)[segment],
        document
    );
}

function assignPath(document: Record<string, unknown>, path: string, value: unknown): void {
    const segments = path.split(".");
    const leaf = segments.pop()!;

    let current = document;

    for (const segment of segments) {
        if (current[segment] == null || typeof current[segment] !== "object") {
            current[segment] = {};
        }

        current = current[segment] as Record<string, unknown>;
    }

    current[leaf] = value;
}

/** The MQL subset `toMql` emits. Anything else throws rather than quietly not matching. */
function matches(document: Record<string, unknown>, filter: MqlFilter): boolean {
    for (const [key, condition] of Object.entries(filter)) {
        if (key === "$and") {
            if ((condition as MqlFilter[]).every(inner => matches(document, inner)) === false) {
                return false;
            }
            continue;
        }

        if (key === "$or") {
            if ((condition as MqlFilter[]).some(inner => matches(document, inner)) === false) {
                return false;
            }
            continue;
        }

        if (key === "$expr") {
            throw new Error("FakeMongoCollection does not evaluate $expr — use a real server");
        }

        const actual = readPath(document, key);

        if (condition instanceof RegExp) {
            if (condition.test(String(actual)) === false) {
                return false;
            }
            continue;
        }

        if (condition == null || typeof condition !== "object") {
            // Bare equality, which on an array field is membership.
            const isMember = Array.isArray(actual) && actual.includes(condition);

            if (actual !== condition && isMember === false) {
                return false;
            }
            continue;
        }

        if (operatorsMatch(actual, condition as Record<string, unknown>) === false) {
            return false;
        }
    }

    return true;
}

function operatorsMatch(actual: unknown, operators: Record<string, unknown>): boolean {
    for (const [operator, operand] of Object.entries(operators)) {
        switch (operator) {
            case "$eq":
                if (actual !== operand && !(actual == null && operand == null)) return false;
                break;
            case "$ne":
                if (actual === operand || (actual == null && operand == null)) return false;
                break;
            case "$gt":
                if (!((actual as never) > (operand as never))) return false;
                break;
            case "$gte":
                if (!((actual as never) >= (operand as never))) return false;
                break;
            case "$lt":
                if (!((actual as never) < (operand as never))) return false;
                break;
            case "$lte":
                if (!((actual as never) <= (operand as never))) return false;
                break;
            case "$in":
                if ((operand as unknown[]).includes(actual) === false) return false;
                break;
            case "$nin":
                if ((operand as unknown[]).includes(actual)) return false;
                break;
            case "$regex":
                if (new RegExp(operand as string).test(String(actual)) === false) return false;
                break;
            case "$not":
                if ((operand as RegExp).test(String(actual))) return false;
                break;
            default:
                throw new Error(`FakeMongoCollection does not implement ${operator}`);
        }
    }

    return true;
}
