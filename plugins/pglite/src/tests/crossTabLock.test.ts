import { describe, expect, it } from '@jest/globals';
import { webLock, type LockRequester } from '../crossTabLock';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('webLock', () => {
    it('is absent where the runtime has no lock manager', () => {
        expect(webLock('routier-pglite:none', null)).toBeUndefined();
    });

    it('is absent where the runtime has no navigator at all', () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: undefined });

        try {
            expect(webLock('routier-pglite:no-navigator')).toBeUndefined();
        } finally {
            if (original != null) {
                Object.defineProperty(globalThis, 'navigator', original);
            }
        }
    });

    it('holds the named lock until released, so a second holder waits', async () => {
        const acquire = webLock(`routier-pglite:${Math.random()}`);
        const first = await acquire!();
        let secondHeld = false;

        const second = acquire!().then(release => {
            secondHeld = true;
            return release;
        });
        await flush();

        expect(secondHeld).toBe(false);
        first();
        (await second)();
        expect(secondHeld).toBe(true);
    });

    it('does not make different names wait for each other', async () => {
        const first = await webLock(`routier-pglite:a-${Math.random()}`)!();
        const second = await webLock(`routier-pglite:b-${Math.random()}`)!();

        first();
        second();
        expect(true).toBe(true);
    });

    it('rejects when the lock manager refuses the request', async () => {
        const refusing: LockRequester = { request: () => Promise.reject(new Error('refused')) };

        await expect(webLock('routier-pglite:refused', refusing)!()).rejects.toThrow('refused');
    });
});
