import { logger } from '@routier/core/utilities';
import { IDB_PREFIX, OPFS_PREFIX, openOpfsDirectory, opfsSegments } from './browserStorage';

export type StorageKind = 'opfs' | 'idb';

export interface ChoiceMemory {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
}

export type Boot<T> = { ready: Promise<T>; stop: () => void };

export type Booted<T> = { dataDir: string; value: T };

export type StorageChoiceOptions<T> = {
    memory: ChoiceMemory;
    opfsDirectoryExists: (name: string) => Promise<boolean>;
    boot: (dataDir: string) => Boot<T>;
    timeoutMs: number;
    now: () => number;
};

type Finished<T> = { value: T } | null;

export const OPFS_BOOT_TIMEOUT_MS = 10_000;

const storageKey = (name: string): string => `routier-pglite-storage:${name}`;

const bootingKey = (name: string): string => `routier-pglite-booting:${name}`;

const PREFIXES: Record<StorageKind, string> = { opfs: OPFS_PREFIX, idb: IDB_PREFIX };

const dataDirOf = (kind: StorageKind, name: string): string => `${PREFIXES[kind]}${name}`;

const parseKind = (value: string | null): StorageKind | null => (value === 'opfs' || value === 'idb' ? value : null);

const parseStartedAt = (value: string | null): number | null => {
    const startedAt = Number(value ?? Number.NaN);

    return Number.isFinite(startedAt) ? startedAt : null;
};

export const fallbackNameOf = (databaseName: string, dataDir: string): string | null =>
    dataDir === dataDirOf('opfs', databaseName) ? databaseName : null;

export const rememberedDataDir = (name: string, memory: ChoiceMemory): string =>
    dataDirOf(parseKind(memory.get(storageKey(name))) ?? 'opfs', name);

const withinTimeout = <T>(ready: Promise<T>, timeoutMs: number): Promise<Finished<T>> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<Finished<T>>(resolve => {
        timer = setTimeout(() => resolve(null), timeoutMs);
    });

    return Promise.race([ready.then((value): Finished<T> => ({ value })), expired])
        .finally(() => clearTimeout(timer));
};

const warnFallback = (name: string, reason: string): void => {
    logger.warn(`[Routier] PGlite '${name}' is using IndexedDB (${dataDirOf('idb', name)}) instead of OPFS: ${reason}`);
};

export const bootChosenStorage = async <T>(name: string, options: StorageChoiceOptions<T>): Promise<Booted<T>> => {
    const { memory } = options;

    const start = async (kind: StorageKind): Promise<Booted<T>> => {
        const dataDir = dataDirOf(kind, name);

        return { dataDir, value: await options.boot(dataDir).ready };
    };

    const choose = (kind: StorageKind): Promise<Booted<T>> => {
        memory.set(storageKey(name), kind);
        memory.remove(bootingKey(name));
        return start(kind);
    };

    const remembered = parseKind(memory.get(storageKey(name)));

    if (remembered != null) {
        return start(remembered);
    }

    const startedAt = parseStartedAt(memory.get(bootingKey(name)));

    if (startedAt != null && options.now() - startedAt >= options.timeoutMs) {
        warnFallback(name, 'an earlier attempt to open it in OPFS never finished');
        return choose('idb');
    }

    if (startedAt == null && await options.opfsDirectoryExists(name)) {
        return choose('opfs');
    }

    memory.set(bootingKey(name), String(options.now()));
    const attempt = options.boot(dataDirOf('opfs', name));
    let finished: Finished<T>;

    try {
        finished = await withinTimeout(attempt.ready, options.timeoutMs);
    } catch (error) {
        memory.remove(bootingKey(name));
        throw error;
    }

    if (finished != null) {
        memory.set(storageKey(name), 'opfs');
        memory.remove(bootingKey(name));
        return { dataDir: dataDirOf('opfs', name), value: finished.value };
    }

    attempt.stop();
    warnFallback(name, `opening it in OPFS did not finish within ${options.timeoutMs} ms`);
    return choose('idb');
};

const attemptOr = <T>(action: () => T, fallback: T): T => {
    try {
        return action();
    } catch {
        return fallback;
    }
};

export const localStorageMemory: ChoiceMemory = {
    get: key => attemptOr(() => globalThis.localStorage.getItem(key), null),
    set: (key, value) => attemptOr(() => globalThis.localStorage.setItem(key, value), undefined),
    remove: key => attemptOr(() => globalThis.localStorage.removeItem(key), undefined),
};

export const opfsDirectoryExists = (name: string): Promise<boolean> =>
    openOpfsDirectory(opfsSegments(name)).then(() => true, () => false);
