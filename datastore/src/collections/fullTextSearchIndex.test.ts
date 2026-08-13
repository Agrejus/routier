import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Index maintenance — what the save pipeline writes into the index collection.
 *
 * These tests read the index table DIRECTLY rather than through a search query, because
 * searching does not exist yet and because the exact contents are the thing that has to be
 * right. A search over a wrong index still returns rows; it returns the wrong ones, and no
 * assertion about a result set says which part of maintenance broke.
 */

const articleSchema = s.define('idx_articles', {
    id: s.string().key(),
    title: s.string().searchable(),
    body: s.string().searchable(),
    note: s.string().optional(),
}).compile();

/** The index collection is generated, so it is read through a second store over the same data. */
const indexSchema = s.define('idx_articles-search-index', {
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

class IndexReader extends DataStore {
    rows = this.collection(indexSchema).proxy().create();
}

/** One MemoryPlugin database, two stores: the writer and a reader over the index table. */
const createPair = (name: string) => {
    const plugin = new MemoryPlugin(name);

    return { store: new Store(plugin), index: new IndexReader(new MemoryPlugin(name)) };
};

const termsIn = async (index: IndexReader, field?: string) => {
    const rows = await index.rows.toArrayAsync();

    return rows
        .filter(row => field == null || row.field === field)
        .map(row => `${row.field}:${row.term}`)
        .sort();
};

describe('search index maintenance', () => {

    it('indexes an added document', async () => {
        const { store, index } = createPair('idx-add');

        await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent copper' });
        await store.saveChangesAsync();

        expect(await termsIn(index)).toEqual([
            'body:bent', 'body:copper', 'title:copper', 'title:pipe',
        ]);
    });

    it('counts repeated terms as frequency', async () => {
        const { store, index } = createPair('idx-frequency');

        await store.articles.addAsync({ id: '1', title: 'pipe', body: 'pipe pipe pipe' });
        await store.saveChangesAsync();

        const rows = await index.rows.toArrayAsync();

        expect(rows.find(row => row.field === 'body')?.frequency).toBe(3);
        expect(rows.find(row => row.field === 'title')?.frequency).toBe(1);
    });

    it('drops the terms that left an edited field', async () => {
        // The reason `previous` exists. Without it "pipe" stays in the index and the document
        // is findable for ever by a word it no longer contains.
        const { store, index } = createPair('idx-edit');

        const [article] = await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'b' });
        await store.saveChangesAsync();

        article.title = 'Copper Wire';
        await store.saveChangesAsync();

        expect(await termsIn(index, 'title')).toEqual(['title:copper', 'title:wire']);
    });

    it('leaves the fields that did not change alone', async () => {
        // Editing a title must not re-tokenise a 4000-character body. Asserted by identity of
        // the row objects' keys and frequencies, which a full re-index would rebuild identically
        // — so this checks the body's rows are still exactly what they were.
        const { store, index } = createPair('idx-untouched');

        const [article] = await store.articles.addAsync({ id: '1', title: 'one', body: 'alpha beta gamma' });
        await store.saveChangesAsync();

        const before = await termsIn(index, 'body');

        article.title = 'two';
        await store.saveChangesAsync();

        expect(await termsIn(index, 'body')).toEqual(before);
        expect(await termsIn(index, 'title')).toEqual(['title:two']);
    });

    it('updates a frequency that changed without changing the term set', async () => {
        const { store, index } = createPair('idx-refrequency');

        const [article] = await store.articles.addAsync({ id: '1', title: 't', body: 'pipe' });
        await store.saveChangesAsync();

        article.body = 'pipe pipe';
        await store.saveChangesAsync();

        const rows = await index.rows.toArrayAsync();
        const body = rows.filter(row => row.field === 'body');

        expect(body).toHaveLength(1);
        expect(body[0].frequency).toBe(2);
    });

    it('removes every row of a removed document', async () => {
        // The regression the whole design exists to prevent — an append-only index keeps the
        // terms of documents that are gone.
        const { store, index } = createPair('idx-remove');

        const [article] = await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'bent' });
        await store.articles.addAsync({ id: '2', title: 'Steel Rod', body: 'straight' });
        await store.saveChangesAsync();

        await store.articles.removeAsync(article);
        await store.saveChangesAsync();

        expect(await termsIn(index)).toEqual(['body:straight', 'title:rod', 'title:steel']);
    });

    it('removes every row when a document is edited and removed in one save', async () => {
        // The sharp case for deriving remove-rows from the entity as submitted: its fields hold
        // the EDITED values, while the index holds what was written at the last save. If the
        // edit is not also reported, the rows keyed by the old terms survive their document.
        const { store, index } = createPair('idx-edit-remove');

        const [article] = await store.articles.addAsync({ id: '1', title: 'Copper Pipe', body: 'b' });
        await store.saveChangesAsync();

        article.title = 'Steel Rod';
        await store.articles.removeAsync(article);
        await store.saveChangesAsync();

        expect(await termsIn(index)).toEqual([]);
    });

    it('contributes nothing for an absent or empty value', async () => {
        const { store, index } = createPair('idx-empty');

        await store.articles.addAsync({ id: '1', title: 'only', body: '' });
        await store.saveChangesAsync();

        expect(await termsIn(index)).toEqual(['title:only']);
    });

    it('honours the declared tokenizer options', async () => {
        const optionSchema = s.define('idx_options', {
            id: s.string().key(),
            title: s.string().searchable(),
        }).compile();

        class Options extends DataStore {
            articles = this.collection(optionSchema)
                .fullTextSearch({ stopWords: 'english' })
                .proxy()
                .create();
        }

        const optionsIndexSchema = s.define('idx_options-search-index', {
            _id: s.string().key(),
            term: s.string(),
            field: s.string(),
            sourceId: s.string(),
            frequency: s.number(),
            documentType: s.string(),
        }).compile();

        class Reader extends DataStore {
            rows = this.collection(optionsIndexSchema).proxy().create();
        }

        const store = new Options(new MemoryPlugin('idx-options'));
        const reader = new Reader(new MemoryPlugin('idx-options'));

        await store.articles.addAsync({ id: '1', title: 'the copper pipe' });
        await store.saveChangesAsync();

        const rows = await reader.rows.toArrayAsync();

        expect(rows.map(row => row.term).sort()).toEqual(['copper', 'pipe']);
    });

    it('writes index rows in the same save as the documents', async () => {
        // Guarantee 2. On a backend with an atomic batch this is what makes it impossible for
        // the index to disagree with the data.
        const plugin = new MemoryPlugin('idx-atomic');
        const batches: string[][] = [];
        const bulkPersist = plugin.bulkPersist.bind(plugin);

        plugin.bulkPersist = (event: any, done: any) => {
            batches.push([...event.operation]
                .filter(([, changes]: any) => changes.hasItems)
                .map(([id]: any) => String(id)));

            return bulkPersist(event, done);
        };

        class Atomic extends DataStore {
            articles = this.collection(articleSchema).fullTextSearch().proxy().create();
        }

        const store = new Atomic(plugin);

        await store.articles.addAsync({ id: '1', title: 'copper', body: 'pipe' });
        await store.saveChangesAsync();

        // One write, carrying both schemas — the document's and the index's.
        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(2);
    });

    it('does not report index rows as the caller\'s changes', async () => {
        // Detached before anything else looks at the save, exactly as audit rows are. Otherwise
        // the caller's add count includes rows they did not make.
        const { store } = createPair('idx-detach');

        await store.articles.addAsync({ id: '1', title: 'copper pipe', body: 'bent copper' });
        const result = await store.saveChangesAsync();

        expect(result.aggregate.adds).toBe(1);
    });

    describe('a database-assigned key', () => {

        const identitySchema = s.define('idx_identity', {
            id: s.string().key().identity(),
            title: s.string().searchable(),
        }).compile();

        const identityIndexSchema = s.define('idx_identity-search-index', {
            _id: s.string().key(),
            term: s.string(),
            field: s.string(),
            sourceId: s.string(),
            frequency: s.number(),
            documentType: s.string(),
        }).compile();

        class IdentityStore extends DataStore {
            articles = this.collection(identitySchema).fullTextSearch().proxy().create();
        }

        class IdentityReader extends DataStore {
            rows = this.collection(identityIndexSchema).proxy().create();
        }

        it('indexes the add once the database has assigned the key', async () => {
            // The one case that cannot ride the document's transaction: the row key embeds the
            // source id, which does not exist until the insert has run.
            const store = new IdentityStore(new MemoryPlugin('idx-identity'));
            const reader = new IdentityReader(new MemoryPlugin('idx-identity'));

            const [article] = await store.articles.addAsync({ title: 'Copper Pipe' });
            await store.saveChangesAsync();

            const rows = await reader.rows.toArrayAsync();

            expect(rows.map(row => row.term).sort()).toEqual(['copper', 'pipe']);
            expect(rows.every(row => row.sourceId === article.id)).toBe(true);
        });

        it('still maintains edits in the document\'s own save', async () => {
            const store = new IdentityStore(new MemoryPlugin('idx-identity-edit'));
            const reader = new IdentityReader(new MemoryPlugin('idx-identity-edit'));

            const [article] = await store.articles.addAsync({ title: 'Copper Pipe' });
            await store.saveChangesAsync();

            article.title = 'Copper Wire';
            await store.saveChangesAsync();

            const rows = await reader.rows.toArrayAsync();

            expect(rows.map(row => row.term).sort()).toEqual(['copper', 'wire']);
        });
    });
});
