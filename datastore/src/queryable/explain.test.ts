import { beforeEach, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { formatExplanation } from '@routier/core/plugins';
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
        { name: 'ada', rank: 20, displayName: 'Ada' } as never,
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
        expect(result.data[0].name).toBe('ada');
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
            .where(x => x.fullName === 'ada!')
            .explain()
            .toArrayAsync();

        expect(data).toHaveLength(1);
        expect(explanation.summary.memory).toBe(1);
        expect(explanation.summary.reasons).toEqual(['unmapped-property']);
        expect(explanation.executionSteps[0].executedIn).toBe('database');
        expect(explanation.executionSteps[0].options).toHaveLength(0);
        expect(explanation.executionSteps[1].executedIn).toBe('memory');
    });

    it('reports a renamed property as a memory fallback', async () => {
        const { explanation } = await store.players
            .where(x => x.displayName === 'Ada')
            .explain()
            .toArrayAsync();

        expect(explanation.summary.reasons).toEqual(['renamed-property']);
    });

    it('works on the other terminals', async () => {
        const first = await store.players.where(x => x.rank > 10).explain().firstAsync();
        const count = await store.players.explain().countAsync();
        const some = await store.players.explain().someAsync(x => x.rank > 100);

        expect(first.data.name).toBe('ada');
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
