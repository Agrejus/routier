export type DirectoryLike = {
    keys(): AsyncIterable<string>;
    removeEntry(name: string, options: { recursive: boolean }): Promise<void>;
};

export type LegacyStorage = {
    opfsRoot(): Promise<DirectoryLike | null>;
    indexedDbNames(): Promise<string[]>;
    deleteIndexedDb(name: string): Promise<void>;
};

const LEGACY_NAME = /^inspector-[a-z]+-\d+$/;

const INDEXED_DB_PREFIXES = ['/pglite/', '_pouch_', ''];

const isLegacyIndexedDb = (name: string): boolean =>
    INDEXED_DB_PREFIXES.some(prefix => name.startsWith(prefix) && LEGACY_NAME.test(name.slice(prefix.length)));

const opfsRemovals = async (root: DirectoryLike | null): Promise<Promise<string>[]> => {
    const removals: Promise<string>[] = [];

    if (root == null) {
        return removals;
    }

    for await (const name of root.keys()) {
        if (LEGACY_NAME.test(name)) {
            removals.push(root.removeEntry(name, { recursive: true }).then(() => name));
        }
    }

    return removals;
};

const deleteIndexedDbDatabase = (name: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error(`deleting '${name}' is blocked by an open connection`));
    });

export const browserLegacyStorage: LegacyStorage = {
    opfsRoot: async () => typeof navigator.storage?.getDirectory === 'function' ? navigator.storage.getDirectory() : null,
    indexedDbNames: async () => typeof indexedDB?.databases === 'function'
        ? (await indexedDB.databases()).flatMap(database => database.name == null ? [] : [database.name])
        : [],
    deleteIndexedDb: deleteIndexedDbDatabase,
};

export async function removeLegacyInspectorDatabases(storage: LegacyStorage = browserLegacyStorage): Promise<string[]> {
    const opfs = await opfsRemovals(await storage.opfsRoot());
    const indexedDbs = (await storage.indexedDbNames())
        .filter(isLegacyIndexedDb)
        .map(name => storage.deleteIndexedDb(name).then(() => name));

    const outcomes = await Promise.allSettled([...opfs, ...indexedDbs]);

    return outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? [outcome.value] : []);
}
