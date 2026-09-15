import { PropertyInfo } from "../PropertyInfo";
import { CompiledSchema, SchemaTypes } from "../types";
import { isArrayValued } from "./propertyKind";

/**
 * Turns the dates on a STORAGE-shape record back into Dates, in place.
 *
 * The datastore serializes a Date to an ISO string, and a store that persists JSON hands the
 * string back. A plugin that runs the caller's lambdas over its own records has to undo that
 * first: a string is never greater than a Date and has no `getTime()`. It is the one thing JSON
 * changed, so it is the one thing undone. Keys stay under their `from` names, because the
 * datastore deserializes the rows the plugin returns, by those names.
 *
 * Not the full `schema.deserialize`, which also moves every key to its in-memory name: rows
 * deserialized twice lose every renamed property.
 *
 * Only a string is converted, so a Date the store kept as a Date is left alone, and so is a
 * record that was already revived. The datastore's own deserialize does the same, so a revived
 * record deserializes to the same entity.
 */
export type StorageDateReviver = (record: Record<string, unknown>) => void;

type DatePath = {
    /** Storage names from the root, the date itself last. */
    readonly segments: readonly string[];
    /** An array of dates rather than one. */
    readonly isArray: boolean;
};

const collectDatePaths = (properties: readonly PropertyInfo<any>[], paths: DatePath[]) => {
    for (const property of properties) {

        // The stored value belongs to whoever wrote it: a custom serializer, deserializer or
        // transform reads it back, and would be handed a Date it did not expect. Unmapped
        // properties are never stored.
        if (property.valueSerializer != null || property.valueDeserializer != null || property.transform != null || property.isUnmapped) {
            continue;
        }

        if (property.type === SchemaTypes.Object) {
            collectDatePaths(property.children, paths);
            continue;
        }

        const isArray = isArrayValued(property.type) && property.innerSchema?.type === SchemaTypes.Date;

        if (property.type !== SchemaTypes.Date && isArray === false) {
            continue;
        }

        paths.push({
            segments: [...property.getParentPathArray({ useFromPropertyName: true }), property.getResolvedName()],
            isArray
        });
    }
};

const reviveAt = (record: Record<string, unknown>, path: DatePath) => {
    const { segments } = path;
    let parent: any = record;

    for (let i = 0, length = segments.length - 1; i < length; i++) {
        parent = parent[segments[i]];

        // An absent or null parent holds no date
        if (parent == null || typeof parent !== "object") {
            return;
        }
    }

    const key = segments[segments.length - 1];
    const value = parent[key];

    if (path.isArray === false) {
        if (typeof value === "string") {
            parent[key] = new Date(value);
        }

        return;
    }

    if (Array.isArray(value)) {
        for (let i = 0, length = value.length; i < length; i++) {
            if (typeof value[i] === "string") {
                value[i] = new Date(value[i]);
            }
        }
    }
};

/** Per schema: `null` for a schema with no dates, so a caller can skip the pass. */
const revivers = new WeakMap<object, StorageDateReviver | null>();

/**
 * The reviver for `schema`'s records, or `null` when it declares no dates.
 *
 * Built once per compiled schema. A read revives every row it returns, so the paths are resolved
 * here rather than per row.
 */
export const getStorageDateReviver = (schema: CompiledSchema<any>): StorageDateReviver | null => {
    const cached = revivers.get(schema);

    if (cached !== undefined) {
        return cached;
    }

    const paths: DatePath[] = [];

    collectDatePaths(schema.properties, paths);

    const reviver: StorageDateReviver | null = paths.length === 0
        ? null
        : record => {
            for (let i = 0, length = paths.length; i < length; i++) {
                reviveAt(record, paths[i]);
            }
        };

    revivers.set(schema, reviver);

    return reviver;
};
