import { describe, expect, it, jest } from '@jest/globals';
import { bootWithFallback, planStorage, storageBootRecord, type Boot, type BootRecord } from '../opfsBoot';

const memoryRecord = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    const record: BootRecord = {
        read: dataDir => values.get(dataDir) ?? null,
        write: (dataDir, state) => { values.set(dataDir, state); },
        clear: dataDir => { values.delete(dataDir); },
    };
    return { record, values };
};

const OPFS = 'opfs-ahp://app';
const IDB = 'idb://app';

const resolving = <T>(value: T) => {
    const stop = jest.fn();
    const boot: Boot<T> = { database: Promise.resolve(value), stop };
    return { boot, stop };
};

const hanging = () => {
    const stop = jest.fn();
    const boot: Boot<string> = { database: new Promise<string>(() => undefined), stop };
    return { boot, stop };
};

describe('planStorage', () => {
    it('keeps an explicit prefix exactly as named, with no fallback', () => {
        const { record } = memoryRecord();

        expect(planStorage(OPFS, OPFS, record)).toEqual({ kind: 'direct', dataDir: OPFS });
        expect(planStorage(IDB, IDB, record)).toEqual({ kind: 'direct', dataDir: IDB });
    });

    it('keeps IndexedDB where the browser chose it, with no fallback', () => {
        expect(planStorage('app', IDB, memoryRecord().record)).toEqual({ kind: 'direct', dataDir: IDB });
    });

    it('has no fallback where there is nowhere to record a boot', () => {
        expect(planStorage('app', OPFS, null)).toEqual({ kind: 'direct', dataDir: OPFS });
    });

    it('tries OPFS with IndexedDB behind it the first time', () => {
        const { record } = memoryRecord();

        expect(planStorage('app', OPFS, record)).toEqual({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record });
    });

    it('uses OPFS alone once it has booted there, so a slow boot never swaps the data away', () => {
        const { record } = memoryRecord({ [OPFS]: 'ok' });

        expect(planStorage('app', OPFS, record)).toEqual({ kind: 'direct', dataDir: OPFS });
    });

    it.each(['pending', 'failed'])('goes straight to IndexedDB when the last OPFS boot was %s', state => {
        const { record } = memoryRecord({ [OPFS]: state });

        expect(planStorage('app', OPFS, record)).toEqual({ kind: 'direct', dataDir: IDB });
    });
});

describe('bootWithFallback', () => {
    it('boots a direct plan and reports its directory', async () => {
        const booted = await bootWithFallback({ kind: 'direct', dataDir: IDB }, () => resolving('db').boot, 1000);

        expect(booted).toEqual({ database: 'db', dataDir: IDB });
    });

    it('records a successful OPFS boot so later visits never fall back', async () => {
        const { record, values } = memoryRecord();

        const booted = await bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, () => resolving('opfs').boot, 1000);

        expect(booted).toEqual({ database: 'opfs', dataDir: OPFS });
        expect(values.get(OPFS)).toBe('ok');
    });

    it('marks the boot pending before it starts, so a tab that freezes is remembered', async () => {
        const { record, values } = memoryRecord();
        let seen: string | undefined;

        await bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, directory => {
            seen = values.get(directory);
            return resolving('opfs').boot;
        }, 1000);

        expect(seen).toBe('pending');
    });

    it('stops a hanging OPFS boot and reopens the same database on IndexedDB', async () => {
        const { record, values } = memoryRecord();
        const opfs = hanging();
        const idb = resolving('idb');
        const boot = jest.fn((directory: string) => directory === OPFS ? opfs.boot : idb.boot);

        const booted = await bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, boot, 20);

        expect(booted).toEqual({ database: 'idb', dataDir: IDB });
        expect(opfs.stop).toHaveBeenCalledTimes(1);
        expect(boot.mock.calls.map(([directory]) => directory)).toEqual([OPFS, IDB]);
        expect(values.get(OPFS)).toBe('failed');
    });

    it('waits the whole timeout before falling back', async () => {
        const { record } = memoryRecord();
        const late = new Promise<string>(resolve => setTimeout(() => resolve('opfs'), 20));

        const booted = await bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, () => ({ database: late, stop: jest.fn() }), 200);

        expect(booted.dataDir).toBe(OPFS);
    });

    it('does not leave the timer running after a boot that finished in time', async () => {
        jest.useFakeTimers();
        try {
            const { record } = memoryRecord();

            await bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, () => resolving('opfs').boot, 1000);

            expect(jest.getTimerCount()).toBe(0);
        } finally {
            jest.useRealTimers();
        }
    });

    it('rethrows an OPFS boot error and forgets the attempt, rather than switching storage', async () => {
        const { record, values } = memoryRecord();
        const failing: Boot<string> = { database: Promise.reject(new Error('wasm missing')), stop: jest.fn() };

        await expect(bootWithFallback({ kind: 'fallback', dataDir: OPFS, fallback: IDB, record }, () => failing, 1000)).rejects.toThrow('wasm missing');
        expect(values.has(OPFS)).toBe(false);
    });
});

describe('storageBootRecord', () => {
    it('reads, writes and clears one key per data directory in a Storage', () => {
        const values = new Map<string, string>();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value); },
            removeItem: (key: string) => { values.delete(key); },
        };
        const record = storageBootRecord(storage);

        expect(record.read(OPFS)).toBeNull();
        record.write(OPFS, 'ok');
        expect(values.get(`routier-pglite-boot:${OPFS}`)).toBe('ok');
        expect(record.read(OPFS)).toBe('ok');
        expect(record.read('opfs-ahp://other')).toBeNull();
        record.clear(OPFS);
        expect(values.size).toBe(0);
    });
});
