import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Miniflare } from 'miniflare';
import { uuidv4 } from '@routier/core';
import { describePluginContract, describeVectorSearch } from '@routier/test-utils';
import { D1DbPlugin, type D1Database } from '@routier/sqlite-plugin/d1';

/**
 * The D1 plugin against a REAL D1 binding, served by workerd through Miniflare.
 *
 * `plugins/sqlite/src/tests/d1.test.ts` runs the same contract against a double built over
 * `node:sqlite`. A double proves the plugin is consistent with what its author believed; it
 * cannot prove the belief. Three assumptions were load-bearing and only checkable here:
 *
 *  1. `batch()` is one transaction, so a failure part way through leaves nothing behind.
 *     Without this the whole design is wrong — a half-applied save is worse than a failed
 *     one, because the change tracker believes none of it landed.
 *  2. Results come back positionally, one per statement, so the prepended CREATE TABLE
 *     statements can be sliced off and the rest matched to their operations by index.
 *  3. A missing table is reported with the words "no such table", which is what the query
 *     path matches on to create it and retry. D1 wraps it — the real text is
 *     `D1_ERROR: no such table: x: SQLITE_ERROR` — and a wrapper that dropped the phrase
 *     would turn lazy creation into a hard failure on the first read of every collection.
 *
 * Opt-in behind E2E_CONTAINERS with the other suites that need a runtime, though this one
 * needs no Docker: Miniflare runs workerd directly.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

let miniflare: Miniflare;

/**
 * Bindings resolved once in `beforeAll`.
 *
 * They have to be plain variables rather than fetched inside each factory: `getD1Database` is
 * async, and `describePluginContract` calls its factory synchronously from inside a test. A
 * factory that kicked off the lookup and returned would hand back a plugin whose binding is
 * still undefined.
 */
let contractDatabase: D1Database;
let vectorDatabase: D1Database;
let assumptionDatabase: D1Database;

const binding = async (name: string): Promise<D1Database> =>
    await miniflare.getD1Database(name) as unknown as D1Database;

/**
 * What "delete this database" means for a binding: drop every table in it.
 *
 * Needed because a D1 binding is not per-test the way an in-process store is. Every other
 * backend the contract runs against gets a fresh database per factory call — the name carries
 * a uuid — so isolation is free and `destroy` can be a no-op. Here all the plugins share one
 * database, `destroy` is the contract's only teardown hook, and without a real one each test
 * seeds on top of the last: counts drift while the orderings stay plausible.
 */
const dropEverything = (database: D1Database) => async (): Promise<void> => {
    const { results } = await database
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`)
        .all<{ name: string }>();

    for (const { name } of results) {
        await database.prepare(`DROP TABLE IF EXISTS "${name}"`).all();
    }
};

suite('Cloudflare D1 via Miniflare', () => {

    beforeAll(async () => {
        miniflare = new Miniflare({
            modules: true,
            script: 'export default {};',
            // One binding per suite below, so no two share a database.
            d1Databases: { CONTRACT: 'contract', VECTORS: 'vectors', ASSUMPTIONS: 'assumptions' },
        });

        [contractDatabase, vectorDatabase, assumptionDatabase] = await Promise.all([
            binding('CONTRACT'),
            binding('VECTORS'),
            binding('ASSUMPTIONS'),
        ]);
    }, 120_000);

    afterAll(async () => {
        await miniflare?.dispose();
    });

    describe('assumptions the double cannot check', () => {

        it('applies nothing when a statement in the batch fails', async () => {
            const db = assumptionDatabase;

            await db.prepare('CREATE TABLE IF NOT EXISTS atomicity (a INTEGER)').all();
            await db.prepare('INSERT INTO atomicity (a) VALUES (1)').all();

            await expect(db.batch([
                db.prepare('INSERT INTO atomicity (a) VALUES (2)'),
                db.prepare('INSERT INTO no_such_table (a) VALUES (3)'),
            ])).rejects.toThrow();

            const { results } = await db.prepare('SELECT a FROM atomicity').all<{ a: number }>();

            // The row from the successful first statement must be gone.
            expect(results).toEqual([{ a: 1 }]);
        });

        it('returns one result per statement, in order', async () => {
            const db = assumptionDatabase;

            await db.prepare('CREATE TABLE IF NOT EXISTS ordering (a INTEGER)').all();

            const batched = await db.batch<{ a: number }>([
                db.prepare('INSERT INTO ordering (a) VALUES (?) RETURNING a').bind(1),
                db.prepare('INSERT INTO ordering (a) VALUES (?) RETURNING a').bind(2),
            ]);

            // Positional alignment is what lets the plugin slice off its prepended CREATE
            // statements and match the rest to operations by index.
            expect(batched).toHaveLength(2);
            expect(batched[0].results).toEqual([{ a: 1 }]);
            expect(batched[1].results).toEqual([{ a: 2 }]);
        });

        it('says "no such table" for a missing table', async () => {
            const db = assumptionDatabase;

            // The exact phrase the query path matches on to create the table and retry.
            await expect(db.prepare('SELECT * FROM definitely_missing').all())
                .rejects.toThrow(/no such table/);
        });
    });

    describePluginContract(
        'cloudflare d1 (miniflare)',
        () => new D1DbPlugin(contractDatabase, { deleteDatabase: dropEverything(contractDatabase) }),
        {
            supportsRichTypes: false,
            knownFailing: [],
        },
    );

    describeVectorSearch(
        'cloudflare d1 (miniflare)',
        () => new D1DbPlugin(vectorDatabase, { deleteDatabase: dropEverything(vectorDatabase) }),
        { borrowsConnection: true },
    );
});
