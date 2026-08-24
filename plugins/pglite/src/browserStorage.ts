/**
 * Where PGlite's data lives in a browser, and how to remove it.
 *
 * Separate from `index.browser.ts` so the decisions here can be tested without loading PGlite
 * or its worker.
 */

const OPFS_PREFIX = 'opfs-ahp://';
const IDB_PREFIX = 'idb://';
const MEMORY_PREFIX = 'memory://';

/** Only these name a storage. Anything else is a database name, `://` in it or not. */
const KNOWN_PREFIXES = [OPFS_PREFIX, IDB_PREFIX, MEMORY_PREFIX];

/**
 * WebKit caps synchronous access handles at 252 and a PostgreSQL installation needs over 300
 * files, so `opfs-ahp` cannot open there. Every iOS browser is WebKit, not just Safari.
 */
const capsSyncAccessHandles = (userAgent: string): boolean =>
    /iphone|ipad|ipod/i.test(userAgent)
    || /^((?!chrome|android|crios|fxios).)*safari/i.test(userAgent)
    // An iPad in "Request Desktop Website" sends a Macintosh UA with no iPad token — Chrome
    // and Edge included, which are WebKit there too. A Mac has no touch points.
    || (/macintosh|mac os x/i.test(userAgent) && (globalThis.navigator?.maxTouchPoints ?? 0) > 0);

/**
 * The data directory a bare name becomes: OPFS, or IndexedDB where OPFS cannot hold a
 * PostgreSQL installation. A name that already carries a prefix is returned untouched, because
 * the prefix is the caller saying it outright.
 */
export const resolveDataDir = (databaseName: string, userAgent: string): string =>
    KNOWN_PREFIXES.some(prefix => databaseName.startsWith(prefix))
        ? databaseName
        : `${capsSyncAccessHandles(userAgent) ? IDB_PREFIX : OPFS_PREFIX}${databaseName}`;

/** Waited between attempts while the browser releases a terminated worker's access handles. */
const RELEASE_DELAYS_MS = [0, 50, 150, 400, 1000];

const isTransient = (error: unknown): boolean => {
    const name = (error as { name?: unknown } | null)?.name;

    return name === 'NoModificationAllowedError' || name === 'InvalidStateError';
};

const isMissing = (error: unknown): boolean => (error as { name?: unknown } | null)?.name === 'NotFoundError';

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const removeOpfsDirectory = async (path: string): Promise<void> => {
    const segments = path.split('/').filter(segment => segment.length > 0);
    const name = segments.pop();

    if (name == null) {
        throw new Error(`'${OPFS_PREFIX}' needs a directory name`);
    }

    let directory = await navigator.storage.getDirectory();

    for (const segment of segments) {
        directory = await directory.getDirectoryHandle(segment);
    }

    await directory.removeEntry(name, { recursive: true });
};

const deleteIndexedDbDatabase = (name: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        // `blocked` means the delete is still pending behind an open connection, not that it
        // happened. Resolving here would report success over data that is still there — so it
        // is raised as transient, and the retry loop waits for the connection to go.
        request.onblocked = () => reject(Object.assign(
            new Error(`deleting IndexedDB database '${name}' is blocked by an open connection`),
            { name: 'InvalidStateError' }
        ));
    });

/**
 * Deletes the storage behind a resolved data directory.
 *
 * Retries, because the browser releases a terminated worker's OPFS access handles after the
 * close that terminated it has already resolved, and a delete landing in that window fails with
 * `NoModificationAllowedError`. Deleting storage that is not there succeeds.
 */
export async function deleteDataDir(dataDir: string): Promise<void> {
    if (dataDir.startsWith(MEMORY_PREFIX)) {
        return;
    }

    if (dataDir.startsWith(IDB_PREFIX)) {
        // Verified against PGlite 0.5: `idb://app` is the IndexedDB database `/pglite/app`.
        const name = `/pglite/${dataDir.slice(IDB_PREFIX.length)}`;

        await withReleaseRetry(() => deleteIndexedDbDatabase(name));
        return;
    }

    if (!dataDir.startsWith(OPFS_PREFIX)) {
        throw new Error(`Cannot delete '${dataDir}': a browser database is ${OPFS_PREFIX}, ${IDB_PREFIX} or ${MEMORY_PREFIX}`);
    }

    const path = dataDir.slice(OPFS_PREFIX.length);

    await withReleaseRetry(() => removeOpfsDirectory(path));
}

/** Retries while the storage is still held, and treats an absent database as already deleted. */
const withReleaseRetry = async (remove: () => Promise<void>): Promise<void> => {
    for (const [attempt, wait] of RELEASE_DELAYS_MS.entries()) {
        await delay(wait);

        try {
            await remove();
            return;
        } catch (error) {
            if (isMissing(error)) {
                return;
            }

            if (!isTransient(error) || attempt === RELEASE_DELAYS_MS.length - 1) {
                throw error;
            }
        }
    }
}
