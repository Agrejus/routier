import 'fake-indexeddb/auto';
import { describe, expect, it, jest } from '@jest/globals';
import { browserLegacyStorage, removeLegacyInspectorDatabases, type DirectoryLike, type LegacyStorage } from './legacyInspectorDatabases';

const directory = (names: string[], failing: string[] = []) => {
    const removed: string[] = [];
    const root: DirectoryLike = {
        keys: async function* () {
            yield* names;
        },
        removeEntry: jest.fn(async (name: string) => {
            if (failing.includes(name)) {
                throw new Error(`${name} is locked`);
            }
            removed.push(name);
        }),
    };
    return { root, removed };
};

const storage = (root: DirectoryLike | null, indexedDbs: string[], failing: string[] = []) => {
    const deleted: string[] = [];
    const legacy: LegacyStorage = {
        opfsRoot: async () => root,
        indexedDbNames: async () => indexedDbs,
        deleteIndexedDb: async (name: string) => {
            if (failing.includes(name)) {
                throw new Error(`${name} is blocked`);
            }
            deleted.push(name);
        },
    };
    return { legacy, deleted };
};

describe('removeLegacyInspectorDatabases', () => {
    it('removes timestamped inspector directories from OPFS and keeps everything else', async () => {
        const { root, removed } = directory(['inspector-pglite-1726000000000', 'inspector-pglite', 'inspector-pglite-17-copy', 'shop-17-pglite', '.opfs-sahpool']);

        await removeLegacyInspectorDatabases(storage(root, []).legacy);

        expect(removed).toEqual(['inspector-pglite-1726000000000']);
        expect(root.removeEntry).toHaveBeenCalledWith('inspector-pglite-1726000000000', { recursive: true });
    });

    it('removes timestamped inspector IndexedDB databases for PGlite, Dexie and PouchDB', async () => {
        const { legacy, deleted } = storage(null, [
            '/pglite/inspector-pglite-17',
            'inspector-dexie-17',
            '_pouch_inspector-pouchdb-17',
            '/pglite/inspector-pglite',
            'inspector-dexie',
            'shop-17-dexie',
            '_pouch_other-inspector-dexie-17',
        ]);

        await removeLegacyInspectorDatabases(legacy);

        expect(deleted).toEqual(['/pglite/inspector-pglite-17', 'inspector-dexie-17', '_pouch_inspector-pouchdb-17']);
    });

    it('reports what it removed and skips what it could not', async () => {
        const { root } = directory(['inspector-pglite-1', 'inspector-pglite-2'], ['inspector-pglite-2']);
        const { legacy } = storage(root, ['inspector-dexie-3', 'inspector-dexie-4'], ['inspector-dexie-4']);

        const removed = await removeLegacyInspectorDatabases(legacy);

        expect(removed.sort()).toStrictEqual(['inspector-dexie-3', 'inspector-pglite-1']);
    });

    it('does nothing when there is no OPFS and no IndexedDB database', async () => {
        await expect(removeLegacyInspectorDatabases(storage(null, []).legacy)).resolves.toEqual([]);
    });
});

const withGlobal = async (name: 'navigator' | 'indexedDB', value: object | undefined, run: () => Promise<void>) => {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    try {
        await run();
    } finally {
        if (original == null) {
            Reflect.deleteProperty(globalThis, name);
        } else {
            Object.defineProperty(globalThis, name, original);
        }
    }
};

describe('browserLegacyStorage without the full browser APIs', () => {
    it('uses the OPFS root where the runtime has one', async () => {
        const root = { kind: 'root' };

        await withGlobal('navigator', { storage: { getDirectory: async () => root } }, async () => {
            await expect(browserLegacyStorage.opfsRoot()).resolves.toBe(root);
        });
    });

    it('lists no IndexedDB databases where indexedDB is missing', async () => {
        await withGlobal('indexedDB', undefined, async () => {
            await expect(browserLegacyStorage.indexedDbNames()).resolves.toEqual([]);
        });
    });

    it('lists no IndexedDB databases where the browser cannot enumerate them', async () => {
        await withGlobal('indexedDB', { deleteDatabase: () => undefined }, async () => {
            await expect(browserLegacyStorage.indexedDbNames()).resolves.toEqual([]);
        });
    });

    it('skips databases the browser reports without a name', async () => {
        await withGlobal('indexedDB', { databases: async () => [{ name: 'inspector-dexie-5' }, {}] }, async () => {
            await expect(browserLegacyStorage.indexedDbNames()).resolves.toStrictEqual(['inspector-dexie-5']);
        });
    });

    it('reports a delete the browser fails', async () => {
        const failure = new Error('quota');
        const request: { error: Error; onerror?: () => void } = { error: failure };
        const fake = { deleteDatabase: () => {
            setTimeout(() => request.onerror?.(), 0);
            return request;
        } };

        await withGlobal('indexedDB', fake, async () => {
            await expect(browserLegacyStorage.deleteIndexedDb('inspector-dexie-6')).rejects.toBe(failure);
        });
    });
});

describe('browserLegacyStorage', () => {
    const openDatabase = (name: string) => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => {
            request.result.close();
            resolve();
        };
        request.onerror = () => reject(request.error);
    });

    it('lists and deletes IndexedDB databases', async () => {
        await openDatabase('inspector-dexie-99');

        expect(await browserLegacyStorage.indexedDbNames()).toContain('inspector-dexie-99');

        await browserLegacyStorage.deleteIndexedDb('inspector-dexie-99');

        expect(await browserLegacyStorage.indexedDbNames()).not.toContain('inspector-dexie-99');
    });

    it('reports a delete that is blocked by an open connection', async () => {
        const connection = await new Promise<IDBDatabase>((resolve) => {
            const request = indexedDB.open('inspector-dexie-held');
            request.onsuccess = () => resolve(request.result);
        });
        connection.onversionchange = () => undefined;

        await expect(browserLegacyStorage.deleteIndexedDb('inspector-dexie-held')).rejects.toThrow(/blocked/);
        connection.close();
    });

    it('has no OPFS root where the runtime has no storage directory', async () => {
        await expect(browserLegacyStorage.opfsRoot()).resolves.toBeNull();
    });
});
