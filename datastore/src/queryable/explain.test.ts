import { beforeEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { formatExplanation, RetryDbPlugin } from '@routier/core/plugins';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.explain()` end to end.
 *
 * Over the memory plugin, which pushes nothing down — so every assertion here is about the
 * datastore's own accounting rather than a backend's cleverness.
 */

const schema = s.define('players', {
    id: s.string().key().identity(),
    name: s.string(),
    rank: s.number(),
    displayName: s.string().from('display_name'),
}).modify((w) => ({
    fullName: w.computed((entity) => `${entity.name}!`)
})).compile();

class Store extends DataStore {
    players = this.collection(schema).proxy().create();
}

const seed = async (store: Store) => {
    store.players.addAsync(
        { name: 'james', rank: 20, displayName: 'James' } as never,
        { name: 'grace', rank: 5, displayName: 'Grace' } as never
    );
    await store.saveChangesAsync();
};

let store: Store;

beforeEach(async () => {
    store = new Store(new MemoryPlugin(`explain-${Math.random()}`));
    await seed(store);
});

describe('.explain()', () => {

    it('returns the data AND the explanation', async () => {
        const result = await store.players.where(x => x.rank > 10).explain().toArrayAsync();

        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe('james');
        expect(result.explanation.collection).toBe('players');
        expect(result.explanation.summary.database).toBe(1);
    });

    it('leaves a queryable it was branched from returning bare rows', async () => {
        const base = store.players.where(x => x.rank > 10);
        const explained = base.explain();

        const withExplanation = await explained.toArrayAsync();
        const withoutExplanation = await base.toArrayAsync();

        expect(withExplanation.data).toHaveLength(1);
        // The soundness case: `base` is typed as returning rows, so it must not have been
        // switched to the wrapped shape by its sibling.
        expect(Array.isArray(withoutExplanation)).toBe(true);
        expect(withoutExplanation).toHaveLength(1);
    });

    it('reports a memory fallback and names the cause', async () => {
        const { data, explanation } = await store.players
            .where(x => x.fullName === 'james!')
            .explain()
            .toArrayAsync();

        expect(data).toHaveLength(1);
        expect(explanation.summary.memory).toBe(1);
        expect(explanation.summary.reasons).toEqual(['unmapped-property']);
        expect(explanation.executionSteps[0].executedIn.kind).toBe('database');
        expect(explanation.executionSteps[0].options).toHaveLength(0);
        expect(explanation.executionSteps[1].executedIn.kind).toBe('memory');
    });

    /**
     * A renamed property is planned for the database like any other. The memory plugin holds rows as
     * they are stored, so it hands the option back, and the datastore runs it by the in-memory name
     * after deserialization. The SQL plugins keep it — see the dialect conformance suite.
     */
    it('reports a renamed property the plugin handed back, and answers it', async () => {
        const { data, explanation } = await store.players
            .where(x => x.displayName === 'James')
            .explain()
            .toArrayAsync();

        expect(data.map(x => x.name)).toEqual(['james']);
        expect(explanation.summary.reasons).toEqual(['missing-capability']);
        expect(explanation.summary.memory).toBe(1);
        expect(explanation.executionSteps[0].executedIn.kind).toBe('database');
    });

    it('reports it through a wrapper plugin too', async () => {
        const wrapped = new Store(new RetryDbPlugin(new MemoryPlugin(`explain-${Math.random()}`)));
        await seed(wrapped);

        const { data, explanation } = await wrapped.players
            .where(x => x.displayName === 'James')
            .explain()
            .toArrayAsync();

        expect(data.map(x => x.name)).toEqual(['james']);
        expect(explanation.summary.reasons).toEqual(['missing-capability']);
    });

    it('returns the right rows for a sort, and for a filter, sort and take, over a renamed property', async () => {
        const sorted = await store.players.sort(x => x.displayName).toArrayAsync();
        const windowed = await store.players
            .where(x => x.displayName !== 'Nobody')
            .sortDescending(x => x.displayName)
            .take(1)
            .explain()
            .toArrayAsync();

        expect(sorted.map(x => x.name)).toEqual(['grace', 'james']);
        expect(windowed.data.map(x => x.name)).toEqual(['james']);
        // The sort and take were never reached: a window in front of a filter that did not run
        // would pick the wrong row
        expect(windowed.explanation.summary.memory).toBe(3);
        expect(windowed.explanation.summary.reasons).toEqual(['missing-capability', 'not-reached']);
    });

    it('works on the other terminals', async () => {
        const first = await store.players.where(x => x.rank > 10).explain().firstAsync();
        const count = await store.players.explain().countAsync();
        const some = await store.players.explain().someAsync(x => x.rank > 100);

        expect(first.data.name).toBe('james');
        expect(first.explanation.summary.database).toBeGreaterThan(0);
        expect(count.data).toBe(2);
        expect(count.explanation.collection).toBe('players');
        expect(some.data).toBe(false);
        expect(some.explanation.collection).toBe('players');
    });

    it('names the plugin and the database', async () => {
        const { explanation } = await store.players.explain().toArrayAsync();

        expect(explanation.plugin.kind).toBe('MemoryPlugin');
        expect(explanation.database).toContain('explain-');
    });

    it('renders for a terminal', async () => {
        const { explanation } = await store.players
            .where(x => x.rank > 10)
            .explain()
            .toArrayAsync();

        const output = formatExplanation(explanation);

        expect(output).toContain('players');
        expect(output).toContain('STEP 1 of 1 — database');
        expect(output).toContain('rank > 10');
    });

    it('is not offered after subscribe', () => {
        const subscribed = store.players.subscribe();

        expect((subscribed as unknown as { explain?: unknown }).explain).toBeUndefined();
    });
});
