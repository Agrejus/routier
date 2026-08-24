import { afterEach, describe, expect, it } from '@jest/globals';
import { deleteDataDir, resolveDataDir } from '../browserStorage';

/**
 * The browser storage decisions, tested in Node. Neither PGlite nor its worker is loaded here,
 * which is why these live in their own module.
 */

const SAFARI_MACOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const SAFARI_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const CHROME_MACOS = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0';

const originals = { navigator: globalThis.navigator, indexedDB: (globalThis as any).indexedDB };

const setGlobals = (values: { userAgent?: string; storage?: unknown; indexedDB?: unknown; maxTouchPoints?: number }): void => {
    if (values.userAgent != null || values.storage != null) {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                userAgent: values.userAgent ?? CHROME_MACOS,
                storage: values.storage,
                maxTouchPoints: values.maxTouchPoints ?? 0,
            },
        });
    }

    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: values.indexedDB });
};

const domError = (name: string): Error => Object.assign(new Error(name), { name });

/** Enough of `FileSystemDirectoryHandle` for the delete path, with the failures it has to survive. */
const opfsRoot = (options: { failures?: Error[]; children?: Record<string, unknown> } = {}) => {
    const failures = [...(options.failures ?? [])];
    const removed: string[] = [];

    const handle: any = {
        removed,
        async getDirectoryHandle(name: string) {
            const child = options.children?.[name];

            if (child == null) {
                throw domError('NotFoundError');
            }

            return child;
        },
        async removeEntry(name: string) {
            const failure = failures.shift();

            if (failure != null) {
                throw failure;
            }

            removed.push(name);
        },
    };

    return handle;
};

afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originals.navigator });
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: originals.indexedDB });
});

describe('resolveDataDir', () => {

    it.each([
        ['Safari on macOS', SAFARI_MACOS],
        ['Safari on iOS', SAFARI_IOS],
        ['Chrome on iOS, which is WebKit too', CHROME_IOS],
    ])('sends %s to IndexedDB, because OPFS cannot hold a PostgreSQL installation there', (_label, userAgent) => {
        expect(resolveDataDir('app', userAgent)).toBe('idb://app');
    });

    it.each([
        ['Chrome on macOS', CHROME_MACOS],
        ['Firefox', FIREFOX],
    ])('sends %s to OPFS', (_label, userAgent) => {
        expect(resolveDataDir('app', userAgent)).toBe('opfs-ahp://app');
    });

    it.each(['opfs-ahp://app', 'idb://app', 'memory://app'])('leaves %s alone, prefix and all', dataDir => {
        expect(resolveDataDir(dataDir, SAFARI_MACOS)).toBe(dataDir);
    });

    it('treats a name that merely contains :// as a name, not a storage', () => {
        expect(resolveDataDir('https://example.com/app', CHROME_MACOS)).toBe('opfs-ahp://https://example.com/app');
    });
});

describe('resolveDataDir on an iPad asking for the desktop site', () => {

    it('sends it to IndexedDB, because a desktop UA does not stop it being WebKit', () => {
        setGlobals({ userAgent: CHROME_MACOS, maxTouchPoints: 5 });

        expect(resolveDataDir('app', CHROME_MACOS)).toBe('idb://app');
    });

    it('leaves a real Mac on OPFS', () => {
        setGlobals({ userAgent: CHROME_MACOS, maxTouchPoints: 0 });

        expect(resolveDataDir('app', CHROME_MACOS)).toBe('opfs-ahp://app');
    });
});

describe('deleteDataDir', () => {

    it('has nothing to delete for memory storage', async () => {
        setGlobals({ userAgent: CHROME_MACOS });

        await expect(deleteDataDir('memory://app')).resolves.toBeUndefined();
    });

    it('deletes the IndexedDB database PGlite actually names', async () => {
        const deleted: string[] = [];
        setGlobals({
            userAgent: SAFARI_MACOS,
            indexedDB: {
                deleteDatabase(name: string) {
                    deleted.push(name);
                    const request: any = {};
                    setTimeout(() => request.onsuccess?.(), 0);
                    return request;
                },
            },
        });

        await deleteDataDir('idb://app');

        expect(deleted).toEqual(['/pglite/app']);
    });

    it('retries a blocked IndexedDB delete rather than reporting data gone that is still there', async () => {
        let attempts = 0;
        setGlobals({
            userAgent: SAFARI_MACOS,
            indexedDB: {
                deleteDatabase() {
                    attempts++;
                    const request: any = {};
                    // Blocked until the closed worker's connection is released.
                    setTimeout(() => (attempts < 3 ? request.onblocked?.() : request.onsuccess?.()), 0);
                    return request;
                },
            },
        });

        await deleteDataDir('idb://app');

        expect(attempts).toBe(3);
    });

    it('fails a delete that stays blocked, instead of claiming success', async () => {
        setGlobals({
            userAgent: SAFARI_MACOS,
            indexedDB: {
                deleteDatabase() {
                    const request: any = {};
                    setTimeout(() => request.onblocked?.(), 0);
                    return request;
                },
            },
        });

        await expect(deleteDataDir('idb://app')).rejects.toThrow(/blocked by an open connection/);
    });

    it('removes the OPFS directory', async () => {
        const root = opfsRoot();
        setGlobals({ userAgent: CHROME_MACOS, storage: { getDirectory: async () => root } });

        await deleteDataDir('opfs-ahp://app');

        expect(root.removed).toEqual(['app']);
    });

    it('retries while the closed worker still holds its access handles', async () => {
        const root = opfsRoot({ failures: [domError('NoModificationAllowedError'), domError('NoModificationAllowedError')] });
        setGlobals({ userAgent: CHROME_MACOS, storage: { getDirectory: async () => root } });

        await deleteDataDir('opfs-ahp://app');

        expect(root.removed).toEqual(['app']);
    });

    it('gives up once the handles have plainly not been released', async () => {
        const failures = Array.from({ length: 9 }, () => domError('NoModificationAllowedError'));
        const root = opfsRoot({ failures });
        setGlobals({ userAgent: CHROME_MACOS, storage: { getDirectory: async () => root } });

        await expect(deleteDataDir('opfs-ahp://app')).rejects.toThrow('NoModificationAllowedError');
    });

    it('treats a database that is not there as already deleted', async () => {
        const root = opfsRoot({ failures: [domError('NotFoundError')] });
        setGlobals({ userAgent: CHROME_MACOS, storage: { getDirectory: async () => root } });

        await expect(deleteDataDir('opfs-ahp://app')).resolves.toBeUndefined();
        expect(root.removed).toEqual([]);
    });

    it('walks a nested path instead of treating the slashes as a name', async () => {
        const nested = opfsRoot();
        const root = opfsRoot({ children: { tenants: nested } });
        setGlobals({ userAgent: CHROME_MACOS, storage: { getDirectory: async () => root } });

        await deleteDataDir('opfs-ahp://tenants/app');

        expect(nested.removed).toEqual(['app']);
        expect(root.removed).toEqual([]);
    });

    it('refuses a data directory that is not browser storage', async () => {
        setGlobals({ userAgent: CHROME_MACOS });

        await expect(deleteDataDir('file:///var/data')).rejects.toThrow('Cannot delete');
    });
});
