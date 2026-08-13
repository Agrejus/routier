import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `previous` — what a property held before the save that is about to happen.
 *
 * A delta says what a property holds NOW, which is enough to write the row and not enough to
 * undo anything keyed by the old value. A search index has to delete the rows for terms that
 * just left a field, and only the previous value names them.
 *
 * The hard requirement is that all three change-tracking modes answer identically, because the
 * consumer is one piece of code and the mode is the collection author's choice. The modes get
 * there by completely different routes: proxy restores originals recorded by its `set` trap,
 * immutable already holds the whole prior entity, and diff has to keep a copy because a content
 * hash cannot say what changed.
 */

const articleSchema = s.define('prev_articles', {
    id: s.string().key().identity(),
    title: s.string().searchable(),
    body: s.string().searchable(),
    views: s.number(),
}).compile();


class ProxyStore extends DataStore {
    articles = this.collection(articleSchema).fullTextSearch().proxy().create();
}

class DiffStore extends DataStore {
    articles = this.collection(articleSchema).fullTextSearch().diff().create();
}

class ImmutableStore extends DataStore {
    articles = this.collection(articleSchema).fullTextSearch().immutable().create();
}

/** Reads what the save pipeline assembled, before the plugin is called. */
const capturePreparedUpdates = (store: DataStore) => {
    const seen: any[] = [];
    const original = (store as any).onSavePreparedChanges.bind(store);

    (store as any).onSavePreparedChanges = (changes: any, done: any) => {
        for (const [, schemaChanges] of changes) {
            seen.push(...schemaChanges.updates.map((u: any) => ({ delta: u.delta, previous: u.previous })));
        }
        return original(changes, done);
    };

    return seen;
};

describe('previous values', () => {

    describe('every mode reports the same thing', () => {

        it('proxy', async () => {
            const store = new ProxyStore(new MemoryPlugin('prev-proxy'));
            const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'about pipes', views: 0 });
            await store.saveChangesAsync();

            const updates = capturePreparedUpdates(store);
            article.title = 'Copper Wire';
            await store.saveChangesAsync();

            expect(updates).toHaveLength(1);
            expect(updates[0].delta).toEqual({ title: 'Copper Wire' });
            expect(updates[0].previous).toEqual({ title: 'Copper Pipe' });
        });

        it('immutable', async () => {
            const store = new ImmutableStore(new MemoryPlugin('prev-immutable'));
            const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'about pipes', views: 0 });
            await store.saveChangesAsync();

            const updates = capturePreparedUpdates(store);
            store.articles.update(article, { title: 'Copper Wire' });
            await store.saveChangesAsync();

            expect(updates).toHaveLength(1);
            expect(updates[0].delta).toEqual({ title: 'Copper Wire' });
            expect(updates[0].previous).toEqual({ title: 'Copper Pipe' });
        });

        it('diff reports every root, because a hash cannot say which one moved', async () => {
            // The one mode that answers differently, and it is a property of the mode rather
            // than a gap: change detection is a content hash, so "which property" has no answer.
            // Reporting every root is the same "assume everything" convention its empty delta
            // already uses, and a consumer diffing old against new gets the right result.
            const store = new DiffStore(new MemoryPlugin('prev-diff'));
            const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'about pipes', views: 0 });
            await store.saveChangesAsync();

            const updates = capturePreparedUpdates(store);
            article.title = 'Copper Wire';
            await store.saveChangesAsync();

            expect(updates).toHaveLength(1);
            expect(updates[0].previous.title).toBe('Copper Pipe');
            expect(updates[0].previous.body).toBe('about pipes');
        });
    });

    it('reports the value held before the FIRST change, not the second', async () => {
        // Two edits before one save are ONE update. A consumer undoing this save has to remove
        // what was indexed at the last save — "Copper Pipe" — not the intermediate value, which
        // was never persisted and never indexed.
        const store = new ProxyStore(new MemoryPlugin('prev-twice'));
        const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'b', views: 0 });
        await store.saveChangesAsync();

        const updates = capturePreparedUpdates(store);
        article.title = 'Copper Tube';
        article.title = 'Copper Wire';
        await store.saveChangesAsync();

        expect(updates).toHaveLength(1);
        expect(updates[0].delta).toEqual({ title: 'Copper Wire' });
        expect(updates[0].previous).toEqual({ title: 'Copper Pipe' });
    });

    it('re-baselines after a save', async () => {
        // Without re-taking the baseline, the second save would report the state before the
        // FIRST one and a consumer would try to delete rows that are already gone.
        const store = new DiffStore(new MemoryPlugin('prev-rebaseline'));
        const [article] = await store.articles.addAsync({ title: 'one', body: 'b', views: 0 });
        await store.saveChangesAsync();

        article.title = 'two';
        await store.saveChangesAsync();

        const updates = capturePreparedUpdates(store);
        article.title = 'three';
        await store.saveChangesAsync();

        expect(updates[0].previous.title).toBe('two');
    });

    it('is present without any declaration', async () => {
        // Standard, not opt-in. A consumer can rely on `previous` without knowing what else the
        // store declared, and there is one code path rather than two.
        class Plain extends DataStore {
            articles = this.collection(articleSchema).proxy().create();
        }

        const store = new Plain(new MemoryPlugin('prev-none'));
        const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'b', views: 0 });
        await store.saveChangesAsync();

        const updates = capturePreparedUpdates(store);
        article.title = 'Copper Wire';
        await store.saveChangesAsync();

        expect(updates).toHaveLength(1);
        expect(updates[0].delta).toEqual({ title: 'Copper Wire' });
        expect(updates[0].previous).toEqual({ title: 'Copper Pipe' });
    });

    it('never reaches the plugin', async () => {
        // Datastore-internal. Leaving it on would put the old value of every changed property
        // into every plugin's payload — and over a wire, for the HTTP family.
        const plugin = new MemoryPlugin('prev-strip');
        const seen: any[] = [];
        const bulkPersist = plugin.bulkPersist.bind(plugin);

        plugin.bulkPersist = (event: any, done: any) => {
            for (const [, schemaChanges] of event.operation) {
                seen.push(...schemaChanges.updates);
            }
            return bulkPersist(event, done);
        };

        class Store extends DataStore {
            articles = this.collection(articleSchema).fullTextSearch().proxy().create();
        }

        const store = new Store(plugin);
        const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'b', views: 0 });
        await store.saveChangesAsync();

        article.title = 'Copper Wire';
        await store.saveChangesAsync();

        expect(seen).toHaveLength(1);
        expect('previous' in seen[0]).toBe(false);
    });

    it('reaches an audit declaration, which is where a participant reads it', async () => {
        const historySchema = s.define('prev_history', {
            id: s.string().key().identity(),
            before: s.string(),
            after: s.string(),
        }).compile();

        class Store extends DataStore {
            history = this.collection(historySchema).proxy().create();

            articles = this.collection(articleSchema)
                .fullTextSearch()
                .audit(historySchema)
                .derive((changes, cb) => cb(changes
                    .filter(change => change.operation === 'update')
                    .map(change => ({
                        before: String(change.previous?.title ?? ''),
                        after: String(change.delta?.title ?? ''),
                    }))))
                .proxy()
                .create();
        }

        const store = new Store(new MemoryPlugin('prev-audit'));
        const [article] = await store.articles.addAsync({ title: 'Copper Pipe', body: 'b', views: 0 });
        await store.saveChangesAsync();

        article.title = 'Copper Wire';
        await store.saveChangesAsync();

        const rows = await store.history.toArrayAsync();
        const edit = rows.find(row => row.after === 'Copper Wire');

        expect(edit?.before).toBe('Copper Pipe');
    });
});
