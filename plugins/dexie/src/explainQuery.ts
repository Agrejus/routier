import type { ExecutedQuery } from "@routier/core/plugins";

export type DexieRead = {
    table: string;
    /** The read the chain starts with: a seek, an index walk, or `toCollection()`. */
    read: string;
    /** The JavaScript predicate body over `x`, or `null` when there is no filter. */
    filter: string | null;
    /** `offset(?)` and `limit(?)`, in the order they were applied. */
    steps: readonly string[];
    terminal: string;
    parameters: NonNullable<ExecutedQuery["parameters"]>;
    /** How many index seeks the read made; 0 when it walked. */
    seeks: number;
    walksIndex: boolean;
};

export const dexieTable = (name: string): string =>
    /^[A-Za-z_$][\w$]*$/.test(name) ? `db.${name}` : `db.table(${JSON.stringify(name)})`;

export const readNote = (seeks: number, walksIndex: boolean, hasFilter: boolean): string => {
    if (seeks > 0) {
        const seek = seeks > 1 ? `${seeks} IndexedDB index seeks` : "an IndexedDB index seek";

        return hasFilter ? `${seek}, then a JavaScript filter over the rows it found` : seek;
    }

    const walk = walksIndex ? "an IndexedDB index walk in key order" : "a full table walk, no index";

    return hasFilter ? `${walk}, with a JavaScript filter` : walk;
};

/** The Dexie chain a read ran, with every value written as `?`. */
export const dexieQuery = (read: DexieRead): ExecutedQuery => ({
    text: [
        dexieTable(read.table),
        read.read,
        ...(read.filter == null ? [] : [`filter(x => ${read.filter})`]),
        ...read.steps,
        read.terminal,
    ].join("."),
    ...(read.parameters.length > 0 ? { parameters: read.parameters } : {}),
    language: "dexie",
    note: readNote(read.seeks, read.walksIndex, read.filter != null),
});
