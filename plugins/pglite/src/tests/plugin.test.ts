import { afterEach, describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { vmModulesEnabled } from '@routier/test-utils';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGlite } from '@electric-sql/pglite';
import { PGliteDbPlugin, pgliteDbPlugin } from '../index';

/**
 * What this plugin adds on top of `@routier/postgres-plugin-core`, which the dialect
 * conformance matrix in `e2e/` already covers against this same engine.
 *
 * Four things: that the data directory really persists, that a single connection does not let
 * two transactions interleave, and that a `s.vector()` property works both with and without the
 * pgvector package installed.
 */

const schema = s.define('pglite_rows', {
    id: s.string().key(),
    name: s.string(),
    count: s.number(),
    tags: s.array(s.string()),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).proxy().create();
}

const directories: string[] = [];
const stores: DataStore[] = [];

const dataDirectory = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'routier-pglite-'));

    directories.push(directory);

    return path.join(directory, uuidv4());
};

const open = (dataDir: string) => {
    const store = new Store(new PGliteDbPlugin(dataDir));

    stores.push(store);

    return store;
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch((): void => undefined);
    }

    for (const directory of directories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

// `npm test -w @routier/pglite-plugin` sets the flag; the repo-wide `npm test` does not.
(vmModulesEnabled ? describe : describe.skip)('PGliteDbPlugin', () => {

    it('round-trips a row, including a JSON column', async () => {
        const store = open(dataDirectory());

        await store.rows.addAsync({ id: 'a', name: 'first', count: 2, tags: ['x', 'y'] });
        await store.saveChangesAsync();

        const [found] = await store.rows.where(w => w.id === 'a').toArrayAsync();

        expect(found).toMatchObject({ id: 'a', name: 'first', count: 2, tags: ['x', 'y'] });
    });

    /**
     * The claim the browser build makes about OPFS, tested where it can be: a second plugin
     * over the same data directory, after the first was closed, still has the rows. Same
     * mechanism, a filesystem PGlite can reach from Node.
     */
    it('keeps data in its data directory after the database is closed and reopened', async () => {
        const dataDir = dataDirectory();
        const first = open(dataDir);

        await first.rows.addAsync({ id: 'kept', name: 'survivor', count: 1, tags: [] });
        await first.saveChangesAsync();
        await first.destroyAsync();

        const second = open(dataDir);
        const [found] = await second.rows.where(w => w.id === 'kept').toArrayAsync();

        expect(found?.name).toBe('survivor');
    });

    it('answers a query issued while a save is in flight, without joining its transaction', async () => {
        const store = open(dataDirectory());

        await store.rows.addAsync({ id: 'existing', name: 'existing', count: 0, tags: [] });
        await store.saveChangesAsync();

        // A store writes from more than one place — the caller's save and every view
        // reconciling in response to it — and those overlap. On one connection an unserialised
        // driver would run this SELECT inside the save's open transaction.
        await store.rows.addAsync({ id: 'added', name: 'added', count: 1, tags: [] });

        const [, queried] = await Promise.all([
            store.saveChangesAsync(),
            store.rows.where(w => w.id === 'existing').toArrayAsync(),
        ]);

        expect(queried.map(row => row.id)).toEqual(['existing']);
        expect((await store.rows.toArrayAsync()).map(row => row.id).sort()).toEqual(['added', 'existing']);
    });

    /**
     * pgvector ships as a separate optional package. Without it the probe fails, the embedding
     * is stored as JSONB, and the search is scored in memory — the feature must still work.
     */
    it('supports a vector property with no pgvector extension loaded', async () => {
        const vectors = s.define('pglite_vectors', {
            id: s.string().key(),
            embedding: s.vector(3),
        }).compile();

        class VectorStore extends DataStore {
            items = this.collection(vectors).proxy().create();
        }

        const store = new VectorStore(new PGliteDbPlugin(dataDirectory()));
        stores.push(store);

        await store.items.addAsync(
            { id: 'near', embedding: [1, 0, 0] },
            { id: 'far', embedding: [0, 0, 1] }
        );
        await store.saveChangesAsync();

        const nearest = await store.items.nearest(x => x.embedding, [1, 0, 0], 1).toArrayAsync();

        expect(nearest[0]?.id).toBe('near');
    });

    /**
     * The other half: with the extension loaded, the table gets a real `vector(n)` column and
     * PostgreSQL does the ordering.
     *
     * The column type is asserted, not just the result. Both paths return the same rows by
     * design — that is the point of the fallback — so a test that only checked the answer would
     * pass while the extension quietly failed to load and everything ran in memory.
     */
    it('gives a vector property a real vector column when pgvector is loaded', async () => {
        const vectors = s.define('pglite_pgvectors', {
            id: s.string().key(),
            embedding: s.vector(3),
        }).compile();

        class VectorStore extends DataStore {
            items = this.collection(vectors).proxy().create();
        }

        const database = await PGlite.create(dataDirectory(), { extensions: { vector } });
        const store = new VectorStore(pgliteDbPlugin('pgvector-test', database));
        stores.push(store);

        await store.items.addAsync(
            { id: 'near', embedding: [1, 0, 0] },
            { id: 'far', embedding: [0, 0, 1] }
        );
        await store.saveChangesAsync();

        const nearest = await store.items.nearest(x => x.embedding, [1, 0, 0], 1).toArrayAsync();

        expect(nearest[0]?.id).toBe('near');

        const columns = await database.query<{ udt_name: string }>(
            `SELECT udt_name FROM information_schema.columns
             WHERE table_name = $1 AND column_name = $2`,
            ['pglite_pgvectors', 'embedding']
        );

        expect(columns.rows[0]?.udt_name).toBe('vector');
    });
});
