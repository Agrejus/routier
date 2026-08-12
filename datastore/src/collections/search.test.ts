import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `search()` — the query half of full-text search.
 *
 * Ranking is the part that fails quietly. A wrong filter returns no rows and someone notices; a
 * wrong ORDER returns plausible rows in the wrong order and nobody does. So the ordering
 * assertions here are exact rather than "contains".
 */

const articleSchema = s.define('search_articles', {
    id: s.string().key(),
    title: s.string().searchable(),
    body: s.string().searchable(),
    published: s.boolean(),
    deletedAt: s.date().nullable(),
}).compile();

class Store extends DataStore {
    articles = this.collection(articleSchema).fullTextSearch().proxy().create();
}

let counter = 0;

const seed = async (rows: { id: string; title: string; body: string; published?: boolean }[]) => {
    const store = new Store(new MemoryPlugin(`search-${counter++}`));

    for (const row of rows) {
        await store.articles.addAsync({
            id: row.id,
            title: row.title,
            body: row.body,
            published: row.published ?? true,
            deletedAt: null,
        });
    }

    await store.saveChangesAsync();

    return store;
};

describe('search', () => {

    it('finds documents by a term in any searchable field', async () => {
        const store = await seed([
            { id: '1', title: 'Copper Pipe', body: 'plumbing' },
            { id: '2', title: 'Steel Rod', body: 'copper alloy' },
            { id: '3', title: 'Timber', body: 'wood' },
        ]);

        const hits = await store.articles.search('copper').toArrayAsync();

        expect(hits.map(hit => hit.id).sort()).toEqual(['1', '2']);
    });

    it('requires every term by default', async () => {
        const store = await seed([
            { id: '1', title: 'Copper Pipe', body: 'x' },
            { id: '2', title: 'Copper Rod', body: 'x' },
        ]);

        const hits = await store.articles.search('copper pipe').toArrayAsync();

        expect(hits.map(hit => hit.id)).toEqual(['1']);
    });

    it('accepts any term when asked', async () => {
        const store = await seed([
            { id: '1', title: 'Copper Pipe', body: 'x' },
            { id: '2', title: 'Copper Rod', body: 'x' },
        ]);

        const hits = await store.articles.search('copper pipe', { match: 'any' }).toArrayAsync();

        // Both match; the one matching more terms ranks first.
        expect(hits.map(hit => hit.id)).toEqual(['1', '2']);
    });

    it('ranks by term frequency, then by key', async () => {
        const store = await seed([
            { id: 'a', title: 'copper', body: 'copper copper' },   // 3
            { id: 'b', title: 'copper', body: 'copper' },          // 2
            { id: 'c', title: 'copper', body: 'copper' },          // 2, tie with b
        ]);

        const hits = await store.articles.search('copper').toArrayAsync();

        expect(hits.map(hit => hit.id)).toEqual(['a', 'b', 'c']);
        expect(hits.map(hit => hit.score)).toEqual([3, 2, 2]);
    });

    it('breaks ties the same way every run', async () => {
        const store = await seed([
            { id: 'z', title: 'copper', body: '' },
            { id: 'm', title: 'copper', body: '' },
            { id: 'a', title: 'copper', body: '' },
        ]);

        const first = await store.articles.search('copper').toArrayAsync();
        const second = await store.articles.search('copper').toArrayAsync();

        expect(first.map(hit => hit.id)).toEqual(['a', 'm', 'z']);
        expect(second.map(hit => hit.id)).toEqual(first.map(hit => hit.id));
    });

    it('returns nothing for a query with no terms', async () => {
        const store = await seed([{ id: '1', title: 'copper', body: 'x' }]);

        // No tokens is no query — not "everything".
        expect(await store.articles.search('').toArrayAsync()).toEqual([]);
        expect(await store.articles.search('   ').toArrayAsync()).toEqual([]);
        expect(await store.articles.search('!!!').toArrayAsync()).toEqual([]);
    });

    describe('field scoping', () => {

        it('searches one field', async () => {
            const store = await seed([
                { id: '1', title: 'Copper Pipe', body: 'x' },
                { id: '2', title: 'Steel Rod', body: 'copper' },
            ]);

            const hits = await store.articles.search(x => x.body, 'copper').toArrayAsync();

            expect(hits.map(hit => hit.id)).toEqual(['2']);
        });

        it('searches a named subset', async () => {
            const store = await seed([
                { id: '1', title: 'Copper Pipe', body: 'x' },
                { id: '2', title: 'Steel Rod', body: 'copper' },
            ]);

            const hits = await store.articles.search([x => x.title, x => x.body], 'copper').toArrayAsync();

            expect(hits.map(hit => hit.id).sort()).toEqual(['1', '2']);
        });

        it('throws when scoped to a property that is not searchable', async () => {
            const store = await seed([{ id: '1', title: 'copper', body: 'x' }]);

            // Returning nothing would read as "no results" rather than as the mistake it is.
            expect(() => store.articles.search(x => x.published as never, 'copper'))
                .toThrow(/not searchable/);
        });
    });

    describe('composition', () => {

        it('filters with where', async () => {
            const store = await seed([
                { id: '1', title: 'copper', body: 'x', published: true },
                { id: '2', title: 'copper', body: 'x', published: false },
            ]);

            const hits = await store.articles.search('copper').where(x => x.published === true).toArrayAsync();

            expect(hits.map(hit => hit.id)).toEqual(['1']);
        });

        it('takes after ordering, not before', async () => {
            // The sharp one. Pushing a limit down to a backend that never saw the ranking
            // returns real rows in a plausible order that are not the best ones.
            const store = await seed([
                { id: 'a', title: 'copper', body: '' },              // 1
                { id: 'b', title: 'copper', body: 'copper copper' }, // 3
                { id: 'c', title: 'copper', body: 'copper' },        // 2
            ]);

            const hits = await store.articles.search('copper').take(2).toArrayAsync();

            expect(hits.map(hit => hit.id)).toEqual(['b', 'c']);
        });

        it('skips after ordering', async () => {
            const store = await seed([
                { id: 'a', title: 'copper', body: '' },
                { id: 'b', title: 'copper', body: 'copper copper' },
                { id: 'c', title: 'copper', body: 'copper' },
            ]);

            const hits = await store.articles.search('copper').skip(1).toArrayAsync();

            expect(hits.map(hit => hit.id)).toEqual(['c', 'a']);
        });

        it('lets an explicit sort replace the ranking', async () => {
            const store = await seed([
                { id: 'a', title: 'copper', body: 'copper copper' },
                { id: 'b', title: 'copper', body: '' },
            ]);

            const hits = await store.articles.search('copper').sortDescending(x => x.id).toArrayAsync();

            expect(hits.map(hit => hit.id)).toEqual(['b', 'a']);
        });

        it('drops the score through map', async () => {
            const store = await seed([{ id: '1', title: 'copper', body: 'x' }]);

            const titles = await store.articles.search('copper').map(x => x.title).toArrayAsync();

            expect(titles).toEqual(['copper']);
        });

        it('counts and takes the first', async () => {
            const store = await seed([
                { id: 'a', title: 'copper', body: 'copper' },
                { id: 'b', title: 'copper', body: '' },
            ]);

            expect(await store.articles.search('copper').countAsync()).toBe(2);
            expect((await store.articles.search('copper').firstOrUndefinedAsync())?.id).toBe('a');
        });
    });

    it('exposes score without persisting it', async () => {
        const store = await seed([{ id: '1', title: 'copper', body: 'copper' }]);

        const [hit] = await store.articles.search('copper').toArrayAsync();

        expect(hit.score).toBe(2);
        // Not enumerable: it is a fact about this result, not a property of the entity, so it
        // does not survive a JSON round trip or leak into a comparison with a stored row.
        expect(Object.keys(hit)).not.toContain('score');
        expect(JSON.parse(JSON.stringify(hit)).score).toBeUndefined();
    });

    it('respects a soft-delete scope', async () => {
        // A soft-deleted document can sit in the index — the index sees the raw table — and
        // must still not come back from a search. It is filtered at the document read.
        const softSchema = s.define('search_soft', {
            id: s.string().key(),
            title: s.string().searchable(),
            deletedAt: s.date().nullable(),
        }).compile();

        class SoftStore extends DataStore {
            articles = this.collection(softSchema)
                .fullTextSearch()
                .softDelete(x => x.deletedAt)
                .proxy()
                .create();
        }

        const store = new SoftStore(new MemoryPlugin('search-soft'));
        const [article] = await store.articles.addAsync({ id: '1', title: 'copper', deletedAt: null });
        await store.articles.addAsync({ id: '2', title: 'copper', deletedAt: null });
        await store.saveChangesAsync();

        await store.articles.removeAsync(article);
        await store.saveChangesAsync();

        const hits = await store.articles.search('copper').toArrayAsync();

        expect(hits.map(hit => hit.id)).toEqual(['2']);
    });

    it('throws on a collection with no index', async () => {
        class Plain extends DataStore {
            articles = this.collection(articleSchema).proxy().create();
        }

        const store = new Plain(new MemoryPlugin('search-plain'));

        expect(() => store.articles.search('copper')).toThrow(/no search index/);
    });
});
