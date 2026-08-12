import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `rebuild()` and `check()` — the recompute half of index maintenance.
 *
 * The invariant that matters is at the bottom: a rebuild and incremental maintenance arriving
 * at the same corpus must produce the SAME index. Two code paths write these rows, and nothing
 * else in the system would notice them disagreeing — a search would just quietly return
 * different results depending on how the data got there.
 */

const articleSchema = s.define('rb_articles', {
    id: s.string().key(),
    title: s.string().searchable(),
    body: s.string().searchable(),
}).compile();

const indexSchema = s.define('rb_articles-search-index', {
    _id: s.string().key(),
    term: s.string(),
    field: s.string(),
    sourceId: s.string(),
    frequency: s.number(),
    documentType: s.string(),
}).compile();

class Store extends DataStore {
    articles = this.collection(articleSchema).fullTextSearch().proxy().create();
}

/** A store over the same data with NO index declared, so writes bypass maintenance. */
class Unindexed extends DataStore {
    articles = this.collection(articleSchema).proxy().create();
}

class IndexReader extends DataStore {
    rows = this.collection(indexSchema).proxy().create();
}

const snapshot = async (name: string) => {
    const reader = new IndexReader(new MemoryPlugin(name));
    const rows = await reader.rows.toArrayAsync();

    return rows
        .map(row => `${row._id}=${row.frequency}`)
        .sort();
};

describe('search index rebuild', () => {

    it('builds an index over documents that predate the declaration', async () => {
        // The initial-build case: rows written by a store that never had an index.
        const before = new Unindexed(new MemoryPlugin('rb-initial'));
        await before.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await before.articles.addAsync({ id: '2', title: 'Steel Rod', body: 'straight' });
        await before.saveChangesAsync();

        expect(await snapshot('rb-initial')).toEqual([]);

        const store = new Store(new MemoryPlugin('rb-initial'));
        const summary = await store.articles.fullTextSearch.rebuild();

        expect(summary.added).toBe(6);
        expect(await snapshot('rb-initial')).toHaveLength(6);
    });

    it('writes nothing when the index is already correct', async () => {
        // What makes it safe on a schedule: a healthy index costs two reads and no write.
        const store = new Store(new MemoryPlugin('rb-healthy'));
        await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await store.saveChangesAsync();

        expect(await store.articles.fullTextSearch.rebuild()).toEqual({ added: 0, updated: 0, removed: 0 });
    });

    it('repairs a missing document', async () => {
        // The drift this exists for: a process that died between a document's insert and its
        // index write, simulated here by writing through an unindexed store.
        const store = new Store(new MemoryPlugin('rb-missing'));
        await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await store.saveChangesAsync();

        const sneaky = new Unindexed(new MemoryPlugin('rb-missing'));
        await sneaky.articles.addAsync({ id: '2', title: 'Steel Rod', body: 'straight' });
        await sneaky.saveChangesAsync();

        const drift = await store.articles.fullTextSearch.check();

        expect(drift.missing).toBe(3);
        expect(drift.isHealthy).toBe(false);

        await store.articles.fullTextSearch.rebuild();

        expect((await store.articles.fullTextSearch.check()).isHealthy).toBe(true);
    });

    it('removes rows no document justifies', async () => {
        const store = new Store(new MemoryPlugin('rb-extra'));
        await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await store.saveChangesAsync();

        const reader = new IndexReader(new MemoryPlugin('rb-extra'));
        await reader.rows.addAsync({ _id: 'ghost|title|9', term: 'ghost', field: 'title', sourceId: '9', frequency: 1, documentType: 'rb_articles-search-index' });
        await reader.saveChangesAsync();

        expect((await store.articles.fullTextSearch.check()).extra).toBe(1);

        const summary = await store.articles.fullTextSearch.rebuild();

        expect(summary.removed).toBe(1);
        expect((await store.articles.fullTextSearch.check()).isHealthy).toBe(true);
    });

    it('corrects a frequency that drifted', async () => {
        const store = new Store(new MemoryPlugin('rb-stale'));
        await store.articles.addAsync({ id: '1', title: 'pipe', body: 'pipe pipe' });
        await store.saveChangesAsync();

        const reader = new IndexReader(new MemoryPlugin('rb-stale'));
        const [row] = await reader.rows.where(x => x.field === 'body').toArrayAsync();
        row.frequency = 99;
        await reader.saveChangesAsync();

        expect((await store.articles.fullTextSearch.check()).stale).toBe(1);

        const summary = await store.articles.fullTextSearch.rebuild();

        expect(summary.updated).toBe(1);
        expect((await store.articles.fullTextSearch.check()).isHealthy).toBe(true);
    });

    it('reports a healthy index as healthy', async () => {
        const store = new Store(new MemoryPlugin('rb-check'));
        await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await store.saveChangesAsync();

        expect(await store.articles.fullTextSearch.check()).toMatchObject({
            missing: 0, extra: 0, stale: 0, isHealthy: true,
        });
    });

    it('throws on a collection with no index', async () => {
        const store = new Unindexed(new MemoryPlugin('rb-none'));

        await expect(store.articles.fullTextSearch.check()).rejects.toThrow(/no search index/);
    });

    it('agrees with incremental maintenance, exactly', async () => {
        // THE invariant. One corpus, reached two ways: incrementally through saves, and by a
        // rebuild over the same documents written without an index. The index rows must be
        // identical, or a search returns different answers depending on how the data arrived.
        const incremental = new Store(new MemoryPlugin('rb-agree-a'));
        const [article] = await incremental.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent copper pipe' });
        await incremental.articles.addAsync({ id: '2', title: 'Steel Rod', body: 'straight' });
        await incremental.saveChangesAsync();

        article.title = 'Copper Wire';
        article.body = 'bent copper wire copper';
        await incremental.saveChangesAsync();

        const [doomed] = await incremental.articles.addAsync({ id: '3', title: 'Gone', body: 'gone' });
        await incremental.saveChangesAsync();
        await incremental.articles.removeAsync(doomed);
        await incremental.saveChangesAsync();

        // The same final corpus, written with no index, then rebuilt from scratch.
        const seeded = new Unindexed(new MemoryPlugin('rb-agree-b'));
        await seeded.articles.addAsync({ id: '1', title: 'Copper Wire', body: 'bent copper wire copper' });
        await seeded.articles.addAsync({ id: '2', title: 'Steel Rod', body: 'straight' });
        await seeded.saveChangesAsync();

        const rebuilt = new Store(new MemoryPlugin('rb-agree-b'));
        await rebuilt.articles.fullTextSearch.rebuild();

        expect(await snapshot('rb-agree-b')).toEqual(await snapshot('rb-agree-a'));
    });
});
