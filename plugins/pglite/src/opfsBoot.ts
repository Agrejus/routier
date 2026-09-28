export type BootState = 'pending' | 'ok' | 'failed';

export type BootRecord = {
    read(dataDir: string): string | null;
    write(dataDir: string, state: BootState): void;
    clear(dataDir: string): void;
};

export type StoragePlan =
    | { kind: 'direct'; dataDir: string }
    | { kind: 'fallback'; dataDir: string; fallback: string; record: BootRecord };

export type Boot<T> = { database: Promise<T>; stop(): void };

export type Booted<T> = { database: T; dataDir: string };

const OPFS_PREFIX = 'opfs-ahp://';
const IDB_PREFIX = 'idb://';

const recordKey = (dataDir: string): string => `routier-pglite-boot:${dataDir}`;

export const storageBootRecord = (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): BootRecord => ({
    read: dataDir => storage.getItem(recordKey(dataDir)),
    write: (dataDir, state) => storage.setItem(recordKey(dataDir), state),
    clear: dataDir => storage.removeItem(recordKey(dataDir)),
});

export const planStorage = (databaseName: string, resolved: string, record: BootRecord | null): StoragePlan => {
    if (record == null || resolved === databaseName || resolved.startsWith(OPFS_PREFIX) === false) {
        return { kind: 'direct', dataDir: resolved };
    }

    const fallback = `${IDB_PREFIX}${databaseName}`;
    const state = record.read(resolved);

    if (state === 'pending' || state === 'failed') {
        return { kind: 'direct', dataDir: fallback };
    }

    return state === 'ok' ? { kind: 'direct', dataDir: resolved } : { kind: 'fallback', dataDir: resolved, fallback, record };
};

const TIMED_OUT = Symbol('timed out');

const within = <T>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof TIMED_OUT> => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const expiry = new Promise<typeof TIMED_OUT>(resolve => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
    });

    return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
};

export async function bootWithFallback<T>(
    plan: StoragePlan,
    boot: (dataDir: string) => Boot<T>,
    timeoutMs: number,
): Promise<Booted<T>> {
    if (plan.kind === 'direct') {
        return { database: await boot(plan.dataDir).database, dataDir: plan.dataDir };
    }

    const { record } = plan;

    record.write(plan.dataDir, 'pending');

    const attempt = boot(plan.dataDir);

    try {
        const outcome = await within(attempt.database, timeoutMs);

        if (outcome !== TIMED_OUT) {
            record.write(plan.dataDir, 'ok');
            return { database: outcome, dataDir: plan.dataDir };
        }
    } catch (error) {
        record.clear(plan.dataDir);
        throw error;
    }

    attempt.stop();
    record.write(plan.dataDir, 'failed');

    return { database: await boot(plan.fallback).database, dataDir: plan.fallback };
}
