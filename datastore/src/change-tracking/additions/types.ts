import { InferCreateType, InferType } from "@routier/core/schema";

export interface IAdditions<T extends {}> {
    /**
     * Resolves the pending addition a plugin-returned row corresponds to and REMOVES it —
     * a take, not a peek.
     *
     * Destructive on purpose: `UnknownKeyAdditions` keys by content hash, so two identical
     * pending rows share a key, and consuming on match is what pairs each returned row
     * with a distinct pending entry. `mergeChanges` calls this exactly once per returned
     * add.
     */
    take(entity: InferCreateType<T> | InferType<T>): InferCreateType<T> | undefined;
    set(entity: InferCreateType<T>): void;
    /**
     * Swaps a pending addition for a new value of the same row.
     *
     * Needed because `update()` on an unsaved row produces a new object rather than
     * mutating the stored one, and an implementation may key by something the new value
     * changes — `UnknownKeyAdditions` keys by content hash. Re-keying has to happen under
     * the implementation that owns the key, not at the call site.
     */
    replace(existing: InferCreateType<T>, next: InferCreateType<T>): void;
    size: number;
    values(): InferCreateType<T>[];
    clear(): void;
}
