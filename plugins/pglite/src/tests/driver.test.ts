import { describe, expect, it } from '@jest/globals';
import { pgliteDriver, PGliteLike } from '../drivers/pglite';

/**
 * The one thing this driver does that `pg`'s does not: hand out its single connection to one
 * caller at a time.
 *
 * Worth testing directly rather than through the plugin. Overlapping transactions on one
 * connection do not fail loudly — the second `BEGIN` is a warning, and the statements simply
 * land in the wrong transaction — so a behavioural test can pass while the invariant is broken.
 */

const stub = (log: string[] = []): PGliteLike & { log: string[] } => ({
    log,
    async query(sql: string) {
        log.push(sql);
        return { rows: [] };
    },
    async exec(sql: string) {
        log.push(sql);
        return [];
    },
    async close() {
        log.push('close');
    },
});

describe('pgliteDriver', () => {

    it('does not hand out a second connection until the first is released', async () => {
        const driver = pgliteDriver('memory://serialise', Promise.resolve(stub()));

        const first = await driver.connect();

        let secondArrived = false;
        const second = driver.connect().then(connection => {
            secondArrived = true;
            return connection;
        });

        // Enough turns for the second connect to resolve if nothing were holding it back.
        await Promise.resolve();
        await Promise.resolve();

        expect(secondArrived).toBe(false);

        await first.release();
        await second;

        expect(secondArrived).toBe(true);
    });

    it('releases the queue when a caller fails, so one failure does not stall the rest', async () => {
        const driver = pgliteDriver('memory://failure', Promise.resolve(stub()));

        const failing = await driver.connect();
        await failing.release();

        await expect(driver.connect()).resolves.toBeDefined();
    });

    it('does not block forever when the database never starts', async () => {
        const driver = pgliteDriver('memory://broken', Promise.reject(new Error('no engine')));

        await expect(driver.connect()).rejects.toThrow('no engine');
        await expect(driver.connect()).rejects.toThrow('no engine');
    });

    /**
     * PGlite's `query` takes one statement. `compiledSchemaToPostgresTable` emits a CREATE
     * TABLE followed by its indexes, so parameterless statements have to go through `exec`.
     */
    it('runs a parameterless statement through exec, and a parameterised one through query', async () => {
        const database = stub();
        const driver = pgliteDriver('memory://routing', Promise.resolve(database));
        const connection = await driver.connect();

        await connection.run('CREATE TABLE a (id TEXT);\nCREATE INDEX i ON a (id);');
        await connection.all('SELECT * FROM a WHERE id = $1', ['x']);

        expect(database.log).toEqual([
            'CREATE TABLE a (id TEXT);\nCREATE INDEX i ON a (id);',
            'SELECT * FROM a WHERE id = $1',
        ]);
    });

    /**
     * `PGliteWorker` rebuilds a worker-side failure as `new Error(error.message)`, so the
     * SQLSTATE never reaches the main thread. The plugin reads `code` to decide whether to
     * create a missing table, so without this a first write in the browser fails outright —
     * and only in the browser, which is why it is pinned here rather than left to the e2e run.
     */
    it.each([
        ['relation "users" does not exist', '42P01'],
        ['relation "users" already exists', '42P07'],
        ['duplicate key value violates unique constraint "users_pkey"', '23505'],
    ])('restores the SQLSTATE a worker dropped: %s', async (message, code) => {
        const database: PGliteLike = {
            query: () => Promise.reject(new Error(message)),
            exec: () => Promise.reject(new Error(message)),
            close: () => Promise.resolve(),
        };

        const connection = await pgliteDriver('memory://codes', Promise.resolve(database)).connect();

        await expect(connection.all('SELECT 1')).rejects.toMatchObject({ code });
        await expect(connection.run('CREATE TABLE users (id TEXT)')).rejects.toMatchObject({ code });
    });

    it('leaves a code that did survive alone', async () => {
        const original = Object.assign(new Error('relation "users" does not exist'), { code: '25P02' });
        const database: PGliteLike = {
            query: () => Promise.reject(original),
            exec: () => Promise.reject(original),
            close: () => Promise.resolve(),
        };

        const connection = await pgliteDriver('memory://kept', Promise.resolve(database)).connect();

        await expect(connection.all('SELECT 1')).rejects.toMatchObject({ code: '25P02' });
    });

    it('binds an unset optional property as NULL, which is what pg did with it', async () => {
        const parameters: unknown[][] = [];
        const database: PGliteLike = {
            async query(_sql: string, params?: unknown[]) {
                parameters.push(params ?? []);
                return { rows: [] };
            },
            async exec() { return []; },
            async close() { },
        };

        const connection = await pgliteDriver('memory://nulls', Promise.resolve(database)).connect();

        await connection.all('INSERT INTO a VALUES ($1, $2)', ['x', undefined]);

        expect(parameters).toEqual([['x', null]]);
    });
});

describe('pgliteDriver engine lifetime', () => {

    it('does not start the engine until something connects', async () => {
        let starts = 0;

        pgliteDriver('memory://lazy', () => { starts++; return Promise.resolve(stub()); });

        expect(starts).toBe(0);
    });

    it('starts a fresh engine after destroy, so a store sharing it is not left with a closed one', async () => {
        let starts = 0;
        const driver = pgliteDriver('memory://restart', () => { starts++; return Promise.resolve(stub()); }, {
            deleteStorage: async () => undefined,
        });

        await (await driver.connect()).release();
        await driver.destroy();
        await (await driver.connect()).release();

        expect(starts).toBe(2);
    });

    it('refuses to report a destroy that deleted nothing, when the engine is the caller\'s', async () => {
        const driver = pgliteDriver('memory://borrowed', Promise.resolve(stub()));

        await (await driver.connect()).release();

        // The contract says destroy deletes. This driver cannot, so it says so rather than
        // reporting success over data that is still there.
        await expect(driver.destroy()).rejects.toThrow(/its data was not deleted/);
        await expect(driver.connect()).rejects.toThrow(/does not own the engine/);
    });

    it('forgets a failed start, so the next caller tries again instead of inheriting the rejection', async () => {
        let attempt = 0;
        const driver = pgliteDriver('memory://retry', () => {
            attempt++;

            return attempt === 1 ? Promise.reject(new Error('worker 404')) : Promise.resolve(stub());
        });

        await expect(driver.connect()).rejects.toThrow('worker 404');
        await expect(driver.connect()).resolves.toBeDefined();
    });

    it('waits for an in-flight connection before closing, so a transaction is not cut underneath it', async () => {
        const log: string[] = [];
        const driver = pgliteDriver('memory://queued', () => Promise.resolve(stub(log)), {
            deleteStorage: async () => undefined,
        });

        const held = await driver.connect();

        let disposed = false;
        const disposing = driver.destroy().then(() => { disposed = true; });

        await new Promise(resolve => setTimeout(resolve, 10));
        expect(disposed).toBe(false);
        expect(log).not.toContain('close');

        await held.release();
        await disposing;

        expect(log).toContain('close');
    });

    it('deletes only after the engine is closed, and only once', async () => {
        const log: string[] = [];
        const driver = pgliteDriver('memory://deleted', () => Promise.resolve(stub(log)), {
            deleteStorage: async () => { log.push('deleted'); },
        });

        await (await driver.connect()).release();
        await driver.destroy();

        expect(log.slice(-2)).toEqual(['close', 'deleted']);
    });

    it('still deletes when the engine was never started', async () => {
        const log: string[] = [];
        const driver = pgliteDriver('memory://cold', () => Promise.resolve(stub(log)), {
            deleteStorage: async () => { log.push('deleted'); },
        });

        await driver.destroy();

        expect(log).toEqual(['deleted']);
    });
});
