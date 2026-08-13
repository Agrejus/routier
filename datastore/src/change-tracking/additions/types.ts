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
    /**
     * Re-derives every key from the entities currently held.
     *
     * `replace` covers a patch that produces a NEW value, which is how the immutable path
     * updates an unsaved row. It cannot cover a mutation of the stored object itself — a proxy
     * collection's `entity.field = x` — because nothing is swapped and no call site exists to
     * re-key from. The keys then describe content the entity no longer has, and `take` cannot
     * find the row the plugin returns (defect #25).
     *
     * Called once per save, immediately before the rows are handed to the plugin, so the keys
     * describe exactly what goes over the wire.
     */
    reindex(): void;
    size: number;
    values(): InferCreateType<T>[];
    clear(): void;
}
