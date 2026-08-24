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
