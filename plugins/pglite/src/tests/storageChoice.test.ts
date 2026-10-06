import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '@routier/core/utilities';
import { localStorageMemory, resolveDataDir, type ChoiceMemory } from '../browserStorage';
import { bootChosenStorage, fallbackNameOf, opfsDirectoryExists, type Boot } from '../storageChoice';

const TIMEOUT_MS = 30;
const NOW = 1_000_000;
const STORAGE_KEY = 'routier-pglite-storage:app';
const BOOTING_KEY = 'routier-pglite-booting:app';

const mapMemory = (entries: Record<string, string> = {}): ChoiceMemory & { values: Map<string, string> } => {
    const values = new Map(Object.entries(entries));

    return {
        values,
        get: key => values.get(key) ?? null,
        set: (key, value) => {
            values.set(key, value);
        },
        remove: key => {
            values.delete(key);
        },
    };
};

type Harness = {
    booted: string[];
    stopped: string[];
    markerDuringBoot: (string | null)[];
    boot: (dataDir: string) => Boot<string>;
};

const harness = (memory: ChoiceMemory, behaviour: (dataDir: string) => Promise<string>): Harness => {
    const booted: string[] = [];
    const stopped: string[] = [];
    const markerDuringBoot: (string | null)[] = [];

    return {
        booted,
        stopped,
        markerDuringBoot,
        boot: dataDir => {
            booted.push(dataDir);
            markerDuringBoot.push(memory.get(BOOTING_KEY));
            return { ready: behaviour(dataDir), stop: () => stopped.push(dataDir) };
        },
    };
};

const opens = (dataDir: string): Promise<string> => Promise.resolve(`db at ${dataDir}`);

const hangsInOpfs = (dataDir: string): Promise<string> =>
    dataDir.startsWith('opfs-ahp://') ? new Promise<string>(() => undefined) : opens(dataDir);

const choose = (memory: ChoiceMemory, boot: Harness, exists = false) =>
    bootChosenStorage('app', {
        memory,
        opfsDirectoryExists: () => Promise.resolve(exists),
        boot: boot.boot,
        timeoutMs: TIMEOUT_MS,
        now: () => NOW,
    });

let warn: jest.Spied<typeof logger.warn>;

beforeEach(() => {
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
});

describe('bootChosenStorage on a first visit', () => {
    it('opens OPFS and remembers it when the boot finishes in time', async () => {
        const memory = mapMemory();
        const boot = harness(memory, opens);

        await expect(choose(memory, boot)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'db at opfs-ahp://app' });
        expect(boot.markerDuringBoot).toEqual([String(NOW)]);
        expect([...memory.values]).toEqual([[STORAGE_KEY, 'opfs']]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('stops the hung OPFS worker, opens IndexedDB, remembers it and warns', async () => {
        const memory = mapMemory();
        const boot = harness(memory, hangsInOpfs);

        await expect(choose(memory, boot)).resolves.toEqual({ dataDir: 'idb://app', value: 'db at idb://app' });
        expect(boot.booted).toEqual(['opfs-ahp://app', 'idb://app']);
        expect(boot.stopped).toEqual(['opfs-ahp://app']);
        expect([...memory.values]).toEqual([[STORAGE_KEY, 'idb']]);
        expect(warn).toHaveBeenCalledWith(
            `[Routier] PGlite 'app' is using IndexedDB (idb://app) instead of OPFS: opening it in OPFS did not finish within ${TIMEOUT_MS} ms`
        );
    });

    it('waits the whole timeout before giving up on OPFS', async () => {
        const memory = mapMemory();
        const boot = harness(memory, dataDir => (dataDir.startsWith('idb://')
            ? opens(dataDir)
            : new Promise(resolve => setTimeout(() => resolve('late opfs'), TIMEOUT_MS / 3))));

        await expect(choose(memory, boot)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'late opfs' });
        expect(boot.stopped).toEqual([]);
    });

    it('clears the marker and remembers nothing when OPFS fails outright', async () => {
        const memory = mapMemory();
        const boot = harness(memory, () => Promise.reject(new Error('wasm failed')));

        await expect(choose(memory, boot)).rejects.toThrow('wasm failed');
        expect(boot.booted).toEqual(['opfs-ahp://app']);
        expect([...memory.values]).toEqual([]);
    });

    it('keeps an OPFS database that predates the choice being remembered, without a timeout', async () => {
        const memory = mapMemory();
        const boot = harness(memory, dataDir => new Promise(resolve => setTimeout(() => resolve(dataDir), TIMEOUT_MS * 2)));

        await expect(choose(memory, boot, true)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'opfs-ahp://app' });
        expect(boot.markerDuringBoot).toEqual([null]);
        expect([...memory.values]).toEqual([[STORAGE_KEY, 'opfs']]);
    });
});

describe('bootChosenStorage with a remembered choice', () => {
    it.each(['opfs', 'idb'])('opens %s without racing a timeout', async kind => {
        const memory = mapMemory({ [STORAGE_KEY]: kind });
        const boot = harness(memory, dataDir => new Promise(resolve => setTimeout(() => resolve(dataDir), TIMEOUT_MS * 2)));
        const dataDir = kind === 'idb' ? 'idb://app' : 'opfs-ahp://app';

        await expect(choose(memory, boot)).resolves.toEqual({ dataDir, value: dataDir });
        expect(boot.booted).toEqual([dataDir]);
        expect(boot.markerDuringBoot).toEqual([null]);
    });

    it('ignores a remembered value it does not recognise', async () => {
        const memory = mapMemory({ [STORAGE_KEY]: 'cloud' });
        const boot = harness(memory, opens);

        await expect(choose(memory, boot)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'db at opfs-ahp://app' });
        expect(memory.values.get(STORAGE_KEY)).toBe('opfs');
    });
});

describe('bootChosenStorage after an OPFS boot that never finished', () => {
    it.each([TIMEOUT_MS, TIMEOUT_MS + 1])('opens IndexedDB and warns when the marker is %i ms old', async age => {
        const memory = mapMemory({ [BOOTING_KEY]: String(NOW - age) });
        const boot = harness(memory, opens);

        await expect(choose(memory, boot, true)).resolves.toEqual({ dataDir: 'idb://app', value: 'db at idb://app' });
        expect(boot.booted).toEqual(['idb://app']);
        expect([...memory.values]).toEqual([[STORAGE_KEY, 'idb']]);
        expect(warn).toHaveBeenCalledWith(
            "[Routier] PGlite 'app' is using IndexedDB (idb://app) instead of OPFS: an earlier attempt to open it in OPFS never finished"
        );
    });

    it('joins a boot another tab started moments ago instead of falling back', async () => {
        const memory = mapMemory({ [BOOTING_KEY]: String(NOW - TIMEOUT_MS + 1) });
        const boot = harness(memory, opens);

        await expect(choose(memory, boot, true)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'db at opfs-ahp://app' });
        expect(boot.markerDuringBoot).toEqual([String(NOW)]);
        expect(warn).not.toHaveBeenCalled();
    });

    it('treats an unreadable marker as no marker', async () => {
        const memory = mapMemory({ [BOOTING_KEY]: 'yesterday' });
        const boot = harness(memory, opens);

        await expect(choose(memory, boot, true)).resolves.toEqual({ dataDir: 'opfs-ahp://app', value: 'db at opfs-ahp://app' });
        expect(boot.markerDuringBoot).toEqual([null]);
        expect([...memory.values]).toEqual([[STORAGE_KEY, 'opfs']]);
    });
});

describe('bootChosenStorage timers', () => {
    it('leaves no timer behind once OPFS opens', async () => {
        jest.useFakeTimers();

        try {
            const memory = mapMemory();

            await choose(memory, harness(memory, opens));
            expect(jest.getTimerCount()).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('fallbackNameOf', () => {
    it.each([
        ['app', 'opfs-ahp://app', 'app'],
        ['opfs-ahp://app', 'opfs-ahp://app', null],
        ['app', 'idb://app', null],
    ])('%s resolved to %s falls back as %s', (name, dataDir, expected) => {
        expect(fallbackNameOf(name, dataDir)).toBe(expected);
    });
});

describe('resolveDataDir after a fallback', () => {
    const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

    it.each([
        [{}, 'opfs-ahp://app'],
        [{ [STORAGE_KEY]: 'opfs' }, 'opfs-ahp://app'],
        [{ [STORAGE_KEY]: 'idb' }, 'idb://app'],
    ])('with %j is %s', (entries, expected) => {
        expect(resolveDataDir('app', CHROME, mapMemory(entries))).toBe(expected);
    });

    it('leaves a name with a prefix alone', () => {
        expect(resolveDataDir('opfs-ahp://app', CHROME, mapMemory({ 'routier-pglite-storage:opfs-ahp://app': 'idb' }))).toBe('opfs-ahp://app');
    });

    it('reads localStorage when no memory is given', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: { getItem: (key: string) => (key === STORAGE_KEY ? 'idb' : null) },
        });

        try {
            expect(resolveDataDir('app', CHROME)).toBe('idb://app');
        } finally {
            if (original == null) {
                Reflect.deleteProperty(globalThis, 'localStorage');
            } else {
                Object.defineProperty(globalThis, 'localStorage', original);
            }
        }
    });
});

describe('localStorageMemory', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    afterEach(() => {
        if (original == null) {
            Reflect.deleteProperty(globalThis, 'localStorage');
        } else {
            Object.defineProperty(globalThis, 'localStorage', original);
        }
    });

    it('reads, writes and removes through localStorage', () => {
        const values = new Map<string, string>();

        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: {
                getItem: (key: string) => values.get(key) ?? null,
                setItem: (key: string, value: string) => values.set(key, value),
                removeItem: (key: string) => values.delete(key),
            },
        });

        localStorageMemory.set('a', '1');
        expect(localStorageMemory.get('a')).toBe('1');
        localStorageMemory.remove('a');
        expect(localStorageMemory.get('a')).toBeNull();
    });

    it('forgets quietly where localStorage cannot be reached', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get: () => {
                throw new Error('SecurityError');
            },
        });

        expect(() => localStorageMemory.set('a', '1')).not.toThrow();
        expect(() => localStorageMemory.remove('a')).not.toThrow();
        expect(localStorageMemory.get('a')).toBeNull();
    });
});

describe('opfsDirectoryExists', () => {
    const original = globalThis.navigator;

    const directory = (children: Record<string, object>) => ({
        getDirectoryHandle: (name: string) => {
            const child = children[name];

            return child == null ? Promise.reject(Object.assign(new Error('missing'), { name: 'NotFoundError' })) : Promise.resolve(child);
        },
    });

    const withRoot = (root: object): void => {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: { storage: { getDirectory: () => Promise.resolve(root) } },
        });
    };

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original });
    });

    it('is true when every segment of the path exists', async () => {
        withRoot(directory({ lab: directory({ app: directory({}) }) }));

        await expect(opfsDirectoryExists('lab/app')).resolves.toBe(true);
    });

    it('skips empty segments in the path', async () => {
        withRoot(directory({ lab: directory({ app: directory({}) }) }));

        await expect(opfsDirectoryExists('/lab//app/')).resolves.toBe(true);
    });

    it('is false when the directory is missing', async () => {
        withRoot(directory({ lab: directory({}) }));

        await expect(opfsDirectoryExists('lab/app')).resolves.toBe(false);
    });
});
