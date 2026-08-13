import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Every example in docs/concepts/queries/full-text-search.md, executed.
 *
 * A documentation example that does not compile is worse than no example: it is the first thing
 * a reader copies. These are the same declarations and calls the page shows.
 */

const articleSchema = s.define('doc_articles', {
    id: s.string().key().identity(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    authorNote: s.string(),
    published: s.boolean(),
}).compile();

class AppStore extends DataStore {
    articles = this.collection(articleSchema)
        .fullTextSearch()
        .proxy()
        .create();
}

const seeded = async (name: string) => {
    const store = new AppStore(new MemoryPlugin(name));
    await store.articles.addAsync(
        { title: 'copper pipe', body: 'copper fitting for a copper pipe', authorNote: 'x', published: true },
        { title: 'steel rod', body: 'copper trace', authorNote: 'x', published: false },
    );
    await store.saveChangesAsync();
    return store;
};

describe('documented examples', () => {

    it('a first search', async () => {
        const store = await seeded('doc-first');
        const hits = await store.articles.search('copper pipe').toArrayAsync();

        expect(hits).toHaveLength(1);
    });

    it('matching all or any terms', async () => {
        const store = await seeded('doc-match');

        const strict = await store.articles.search('copper pipe').toArrayAsync();
        const loose = await store.articles.search('copper pipe', { match: 'any' }).toArrayAsync();

        expect(strict).toHaveLength(1);
        expect(loose).toHaveLength(2);
    });

    it('searching one field', async () => {
        const store = await seeded('doc-field');

        const inBody = await store.articles.search(x => x.body, 'copper').toArrayAsync();
        const inEither = await store.articles.search([x => x.title, x => x.body], 'copper').toArrayAsync();

        expect(inBody).toHaveLength(2);
        expect(inEither).toHaveLength(2);
    });

    it('the score', async () => {
        const store = await seeded('doc-score');
        const hits = await store.articles.search('copper').toArrayAsync();

        expect(typeof hits[0].score).toBe('number');
        expect(Object.keys(hits[0])).not.toContain('score');
    });

    it('composing with other operations', async () => {
        const store = await seeded('doc-compose');

        const hits = await store.articles
            .search('copper pipe')
            .where(x => x.published === true)
            .take(10)
            .toArrayAsync();

        const titles = await store.articles
            .search('copper')
            .take(10)
            .map(x => x.title)
            .toArrayAsync();

        expect(hits).toHaveLength(1);
        expect(titles).toEqual(['copper pipe', 'steel rod']);
    });

    it('tokenizer options', async () => {
        const optioned = s.define('doc_optioned', {
            id: s.string().key().identity(),
            title: s.string().searchable(),
        }).compile();

        class Options extends DataStore {
            articles = this.collection(optioned)
                .fullTextSearch({
                    lowercase: true,
                    minTokenLength: 2,
                    maxTokenLength: 64,
                    stopWords: 'none',
                })
                .proxy()
                .create();
        }

        class Custom extends DataStore {
            articles = this.collection(optioned)
                .fullTextSearch({ tokenizer: text => text.toLowerCase().split(/\s+/) })
                .proxy()
                .create();
        }

        expect(() => new Options(new MemoryPlugin('doc-options'))).not.toThrow();
        expect(() => new Custom(new MemoryPlugin('doc-custom'))).not.toThrow();
    });

    it('keeping the index healthy', async () => {
        const store = await seeded('doc-health');

        const drift = await store.articles.fullTextSearch.check();

        expect(drift).toMatchObject({ missing: 0, extra: 0, stale: 0, isHealthy: true });

        if (drift.isHealthy === false) {
            await store.articles.fullTextSearch.rebuild();
        }
    });
});
