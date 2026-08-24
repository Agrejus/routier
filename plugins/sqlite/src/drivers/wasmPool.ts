/**
 * Capacity decisions for the OPFS SAH pool.
 *
 * Separate from `wasmWorker.ts` so they can be tested without loading the SQLite WASM module,
 * which that file imports statically and on purpose.
 */

/**
 * Files kept free in the pool for SQLite's own use — a rollback journal is a second file, and it
 * is created during a transaction rather than at open, so a pool with no slack fails a write
 * long after the open that looked fine.
 */
const POOL_HEADROOM = 8;

/** Added at a time. Each slot is an OPFS file, so growing in steps beats one file per open. */
const POOL_GROWTH = 8;

/** The part of the SAH pool used here. Typed structurally so a test can stand in for it. */
export type SahPool = {
    getCapacity(): number;
    getFileCount(): number;
    addCapacity(n: number): Promise<number>;
};

/**
 * Makes room in the pool before a database needs it.
 *
 * The pool is a fixed set of preallocated file handles — 6 by default — and it does not grow on
 * demand. Past that, sqlite reports "SAH pool is full" and the open fails on a database that is
 * perfectly fine. Every database held open takes a slot, so a page that opened a seventh used
 * to break.
 *
 * Growing beats evicting: an evicted database is one the application may still be using, and a
 * `:memory:` database cannot be reopened at all — it *is* its connection.
 */
export const ensurePoolCapacity = async (pool: SahPool): Promise<void> => {
    // The deficit, not a fixed step. Adding `POOL_GROWTH` once does not establish the condition
    // above it when the pool is already full — capacity 6 with 6 files becomes 14, which still
    // leaves no more than the headroom free.
    const needed = pool.getFileCount() + POOL_HEADROOM + 1 - pool.getCapacity();

    if (needed <= 0) {
        return;
    }

    await pool.addCapacity(Math.max(needed, POOL_GROWTH));
};

/** Names the pool as the cause. Otherwise a full pool reads as a corrupt or missing database. */
export const poolFullError = (pool: SahPool, databaseName: string): Error =>
    new Error(
        `The OPFS SAH pool is full at ${pool.getCapacity()} files, so '${databaseName}' could not be opened. ` +
        `${pool.getFileCount()} are in use. Every database held open takes a slot; destroy the stores you ` +
        `have finished with, which unlinks their file and returns it to the pool.`
    );

export const isPoolFull = (error: unknown): boolean =>
    /pool is full/i.test(error instanceof Error ? error.message : String(error));
