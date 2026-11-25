import type { UnknownRecord } from "../utilities/types";

export type ConflictKind = "add" | "update" | "remove";

/**
 * A local change the server refused because the row changed there first.
 *
 * Every row is in the application's shape. `base` holds the values the edited fields had before
 * the local edit, so it names exactly the fields the client changed; it is empty for an add, and
 * empty when the plugin could not learn them. `remote` is the server's current row, or `null`
 * when the server no longer has it.
 */
export type Conflict<T extends {} = UnknownRecord> = {
    collectionName: string;
    kind: ConflictKind;
    base: Partial<T>;
    local: T;
    remote: T | null;
};

/** Keep the edit queued, unsent, until the app resolves it some other way. */
export type DeferConflict = { defer: true };

/**
 * What to do about a conflict: a row to save and send again, `null` to accept the server's row,
 * or `{ defer: true }`.
 */
export type ConflictResolution<T extends {} = UnknownRecord> = T | null | DeferConflict;

/**
 * Decides a conflict. May be async, so it can ask the user. Throwing hands the change back to
 * the plugin's usual handling for a rejected write.
 */
export type ConflictResolver<T extends {} = UnknownRecord> =
    (conflict: Conflict<T>) => ConflictResolution<T> | Promise<ConflictResolution<T>>;

export const isDeferred = <T extends {}>(resolution: ConflictResolution<T>): resolution is DeferConflict =>
    resolution != null && "defer" in resolution && resolution.defer === true;

/** The server's row wins, and the local edit is dropped. */
export const serverWins = <T extends {} = UnknownRecord>(): ConflictResolver<T> => (): ConflictResolution<T> => null;

/** The local row wins, and is sent again over the server's version. */
export const clientWins = <T extends {} = UnknownRecord>(): ConflictResolver<T> => conflict => conflict.local;

const same = <TValue>(left: TValue, right: TValue): boolean =>
    left === right || JSON.stringify(left) === JSON.stringify(right);

export type FieldValues<TValue> = { base: TValue | undefined; local: TValue; remote: TValue };

export type FieldMergeOptions<T extends {}> = {
    /** Picks the value of a field both sides changed. Defaults to the server's value. */
    onBoth?: <K extends Extract<keyof T, string>>(field: K, values: FieldValues<T[K]>) => T[K];
};

/**
 * Keeps both sides' changes: the server's row, with every field only the client changed set to
 * the client's value. A field both sides changed takes `onBoth`, or the server's value.
 *
 * A row the server no longer has stays deleted.
 */
export const fieldMerge = <T extends {} = UnknownRecord>(options: FieldMergeOptions<T> = {}): ConflictResolver<T> => conflict => {
    const { base, local, remote } = conflict;

    if (remote == null) {
        return null;
    }

    const merged: T = { ...remote };

    for (const field in base) {
        const values = { base: base[field], local: local[field], remote: remote[field] };

        if (same(values.local, values.remote)) {
            continue;
        }

        if (same(values.remote, values.base)) {
            merged[field] = values.local;
            continue;
        }

        if (options.onBoth != null) {
            merged[field] = options.onBoth(field, values);
        }
    }

    return merged;
};

/** Picks a resolver by collection name, and `fallback` for every other collection. */
export const byCollection = <T extends {} = UnknownRecord>(
    resolvers: Readonly<Record<string, ConflictResolver<T>>>,
    fallback: ConflictResolver<T> = serverWins<T>()
): ConflictResolver<T> => conflict => (resolvers[conflict.collectionName] ?? fallback)(conflict);
