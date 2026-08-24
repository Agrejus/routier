import { describe, expect, it } from '@jest/globals';
import { ensurePoolCapacity, isPoolFull, poolFullError, SahPool } from '../drivers/wasmPool';

/**
 * The OPFS SAH pool is a fixed set of preallocated file handles — 6 by default — and it does not
 * grow on demand. Every database held open takes one, so opening a seventh used to fail on a
 * database that was perfectly fine.
 */

const pool = (capacity: number, fileCount: number) => {
    const added: number[] = [];

    return {
        added,
        getCapacity: () => capacity,
        getFileCount: () => fileCount,
        async addCapacity(n: number) {
            added.push(n);
            capacity += n;
            return capacity;
        },
    } satisfies SahPool & { added: number[] };
};

describe('ensurePoolCapacity', () => {

    it('grows the default pool, which cannot hold a seventh database', async () => {
        const subject = pool(6, 1);

        await ensurePoolCapacity(subject);

        expect(subject.added).toEqual([8]);
        expect(subject.getCapacity()).toBe(14);
    });

    it('leaves the headroom actually free, on a pool that is already full', async () => {
        const subject = pool(6, 6);

        await ensurePoolCapacity(subject);

        // A single fixed step would land on 14 and leave no more than the headroom, so the
        // condition this exists to establish would still not hold.
        expect(subject.getCapacity() - subject.getFileCount()).toBeGreaterThan(8);
    });

    it('grows before the pool is full, because a journal is a second file created mid-write', async () => {
        const subject = pool(16, 9);

        await ensurePoolCapacity(subject);

        expect(subject.added).toEqual([8]);
    });

    it('leaves a pool with room alone', async () => {
        const subject = pool(64, 4);

        await ensurePoolCapacity(subject);

        expect(subject.added).toEqual([]);
    });
});

describe('poolFullError', () => {

    it('names the pool and its numbers, so the cause is not read as a corrupt database', () => {
        expect(poolFullError(pool(6, 6), 'app').message)
            .toMatch(/pool is full at 6 files.*'app'.*6 are in use/s);
    });
});

describe('isPoolFull', () => {

    it('recognises what sqlite says when the pool is exhausted', () => {
        expect(isPoolFull(new Error('SAH pool is full. Cannot create file /app'))).toBe(true);
    });

    it.each(['file is not a database', 'database is locked'])('leaves %s to the caller', message => {
        expect(isPoolFull(new Error(message))).toBe(false);
    });
});
