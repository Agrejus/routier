export type LockRequester = Pick<LockManager, 'request'>;

export type CrossContextLock = () => Promise<() => void>;

export const webLock = (name: string, locks: LockRequester | null = globalThis.navigator?.locks ?? null): CrossContextLock | undefined =>
    locks == null
        ? undefined
        : () => new Promise<() => void>((resolve, reject) => {
            locks.request(name, () => new Promise<void>(release => resolve(release))).catch(reject);
        });
