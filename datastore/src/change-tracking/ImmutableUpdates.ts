import { CompiledSchema, IdType, InferType } from "@routier/core/schema";

/**
 * Pending updates expressed as patches against immutable snapshots.
 *
 * SPIKE (see specs/immutable-updates.md): this runs alongside the proxy change tracker
 * rather than replacing it, so both paths can be measured against the same scenarios.
 *
 * Why it exists at all: every defect the stress program found in change tracking was a
 * proxy *lifecycle* bug — tracking state that outlived a save (#11), an array proxy lost
 * when its entity was rebuilt (#12), and a delta whose shape did not match the serializer
 * (#13). None of those are expressible here:
 *
 *  - There is no per-entity dirty flag to forget to reset. Pending means "in this map".
 *  - There are no array proxies to lose. An array is a value, replaced wholesale.
 *  - The delta IS a partial entity, so it serializes with the entity's own serializer.
 *
 * The delta stays FLAT AT THE TOP LEVEL — a partial entity, not a dotted path map. Both
 * consumers need that: the SQL plugins read `Object.keys(delta)` as column names, and the
 * ephemeral plugins take the whole `entity`. A nested change therefore appears as
 * `{ nested: { inner: { value } } }` — one top-level key whose value is a nested object,
 * which is what a document store wants and what SQL never supported anyway.
 */

/** A value that patches replace wholesale rather than merging into. */
const isOpaqueValue = (value: unknown) =>
    value == null
    || typeof value !== "object"
    || Array.isArray(value)
    // Duck-typed rather than `instanceof Date`: a Date that crossed a realm boundary
    // (structuredClone, jest vm) fails instanceof while being a perfectly good Date.
    || typeof (value as any).getTime === "function";

/**
 * A deep merge in which arrays and Dates are values.
 *
 * Merging arrays element-wise would make "remove the last tag" inexpressible, which is
 * exactly the ambiguity that made in-place array mutation unreliable in the proxy model.
 * Replacing them is both cheaper and unambiguous.
 */
export function applyPatch<T extends Record<string, any>>(base: T, patch: Record<string, any>): T {
    const next: Record<string, any> = { ...base };

    for (const key of Object.keys(patch)) {
        const incoming = patch[key];
        const existing = next[key];

        next[key] = isOpaqueValue(incoming) || isOpaqueValue(existing)
            ? incoming
            : applyPatch(existing, incoming);
    }

    return next as T;
}

/** Accumulates successive patches so the delta describes the whole pending change. */
const mergePatch = (existing: Record<string, any>, incoming: Record<string, any>) =>
    applyPatch(existing, incoming);

export type PendingUpdate<T extends {}> = {
    /** The entity as it was when it was first updated — the base the delta is against. */
    readonly original: InferType<T>;
    /** The entity as it is now. This is what goes to the plugin. */
    readonly current: InferType<T>;
    /** Everything that has changed since `original`, as a partial entity. */
    readonly patch: Record<string, any>;
};

export type UpdateRecipe<T extends {}> =
    | Record<string, any>
    | ((current: InferType<T>) => InferType<T>);

/**
 * Resolves a caller's (possibly stale) entity reference to the current value and records
 * the patch produced against it.
 *
 * Identity resolution is the whole point. The caller's object is used ONLY for its id;
 * the patch is applied to whatever the collection currently holds. That makes a stale
 * reference harmless for writes — the failure mode that actually loses data — and makes
 * read-modify-write correct, which a stale copy gets wrong.
 */
export class ImmutableUpdates<TEntity extends {}> {

    private readonly pending = new Map<IdType, PendingUpdate<TEntity>>();

    constructor(private readonly schema: CompiledSchema<TEntity>) { }

    get size() {
        return this.pending.size;
    }

    hasChanges() {
        // O(1). The proxy model had to scan every attachment to answer this.
        return this.pending.size > 0;
    }

    has(id: IdType) {
        return this.pending.has(id);
    }

    entries() {
        return this.pending.entries();
    }

    clear() {
        this.pending.clear();
    }

    forget(id: IdType) {
        this.pending.delete(id);
    }

    /** The current value of a row, or undefined when nothing is pending for it. */
    current(id: IdType) {
        return this.pending.get(id)?.current;
    }

    /**
     * Applies a patch (or updater function) to the row identified by `entity`.
     *
     * @param resolveAttached returns the collection's canonical value for an id, used as
     *   the base the first time a row is updated. Injected rather than reached for so this
     *   class stays independent of how attachment works.
     */
    update(
        entity: InferType<TEntity>,
        recipe: UpdateRecipe<TEntity>,
        resolveAttached: (id: IdType) => InferType<TEntity> | undefined
    ): InferType<TEntity> {
        const id = this.schema.getId(entity);
        const existing = this.pending.get(id);

        // A detached deep copy, so the base is a plain value rather than a proxy and
        // nothing the caller still holds can change it underneath us.
        const base = existing?.current ?? (() => {
            const attached = resolveAttached(id);

            if (attached == null) {
                throw new Error(
                    `Cannot update ${this.schema.collectionName} row "${id}": it is not attached to this collection. ` +
                    `Query it first, or add it — an entity that was removed cannot be updated.`
                );
            }

            return this.schema.clone(attached);
        })();

        const next = typeof recipe === "function"
            ? recipe(base)
            // A patch is applied to the CURRENT value, never to the caller's copy. This is
            // what makes a stale reference safe to pass.
            : applyPatch(base as Record<string, any>, recipe) as InferType<TEntity>;

        const patch = typeof recipe === "function"
            // An updater function returns a whole entity, so what changed has to be
            // derived. Diffing against the base keeps the delta minimal, which matters
            // for the SQL plugins' SET clause.
            ? diff(base as Record<string, any>, next as Record<string, any>)
            : recipe;

        this.pending.set(id, {
            original: existing?.original ?? (base as InferType<TEntity>),
            current: next,
            patch: existing == null ? { ...patch } : mergePatch(existing.patch, patch),
        });

        return next;
    }
}

/**
 * The top-level keys whose values differ, with nested objects narrowed to their changed
 * subtree.
 *
 * Returns whole values for arrays and Dates, per the same rule `applyPatch` follows.
 */
export function diff(base: Record<string, any>, next: Record<string, any>): Record<string, any> {
    const changed: Record<string, any> = {};

    for (const key of Object.keys(next)) {
        const before = base[key];
        const after = next[key];

        if (before === after) {
            continue;
        }

        if (isOpaqueValue(before) || isOpaqueValue(after)) {
            // Dates compare by value, not identity: a re-read produces a different Date
            // object for the same instant, and reporting that as a change would make
            // every read dirty every row.
            const bothDates = typeof before?.getTime === "function" && typeof after?.getTime === "function";

            if (bothDates && before.getTime() === after.getTime()) {
                continue;
            }

            changed[key] = after;
            continue;
        }

        const nested = diff(before, after);

        if (Object.keys(nested).length > 0) {
            changed[key] = nested;
        }
    }

    return changed;
}
