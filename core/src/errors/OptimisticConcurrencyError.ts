import { IdType } from "../schema";

/**
 * A save was rejected because another writer changed one of its rows first.
 *
 * Raised when a schema declares a `.concurrency()` token and an update's expected token
 * no longer matches the stored row. The whole save is rolled back — nothing was applied.
 * The caller's recovery is always the same: re-read the conflicted rows (the re-read
 * merges fresh values into the canonical instances), reapply the intent, and save again.
 */
export class OptimisticConcurrencyError extends Error {

    /** The collection whose rows conflicted. */
    readonly collectionName: string;
    /** Ids of the rows whose stored token no longer matched the writer's read. */
    readonly conflicts: IdType[];

    constructor(collectionName: string, conflicts: IdType[]) {
        super(
            `Optimistic concurrency conflict on '${collectionName}': ${conflicts.length} row(s) were changed by another writer after they were read. ` +
            `Nothing was saved. Re-read the rows, reapply the changes, and save again. Conflicted ids: ${conflicts.map(String).join(", ")}`
        );
        this.name = "OptimisticConcurrencyError";
        this.collectionName = collectionName;
        this.conflicts = conflicts;
    }

    /** Type guard that survives errors crossing realm/serialization boundaries. */
    static is(error: unknown): error is OptimisticConcurrencyError {
        return error instanceof OptimisticConcurrencyError
            || (error != null && typeof error === "object" && (error as Error).name === "OptimisticConcurrencyError");
    }
}
