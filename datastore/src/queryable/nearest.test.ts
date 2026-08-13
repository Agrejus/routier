import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * `.nearest()` end to end, over a backend that cannot do vector search.
 *
 * The memory plugin has no similarity support at all, which is exactly why it is the right
 * subject: this is the path every backend without a native vector index takes, so what passes
 * here is the guaranteed floor rather than a best case.
 *
 * Vectors are 2-D and hand-placed so the expected order is arguable from the page rather than
 * from a computation. Real embeddings would make the assertions unfalsifiable by inspection.
 */

const schema = s.define('documents', {
    id: s.string().key().identity(),
    title: s.string(),
    category: s.string(),
    embedding: s.vector(2),
}).compile();

class Store extends DataStore {
    documents = this.collection(schema).proxy().create();
}

type Row = { title: string, category: string, embedding: number[] };

// Angles from the +x axis: east 0°, northeast 45°, north 90°, west 180°.
const ROWS: Row[] = [
    { title: 'east', category: 'a', embedding: [1, 0] },
    { title: 'northeast', category: 'b', embedding: [1, 1] },
    { title: 'north', category: 'a', embedding: [0, 1] },
    { title: 'west', category: 'b', embedding: [-1, 0] },
];

let store: Store;

beforeAll(async () => {
    store = new Store(new MemoryPlugin('nearest-test'));
    await store.documents.addAsync(...(ROWS as any));
    await store.saveChangesAsync();
});

afterAll(async () => {
    await store?.destroyAsync().catch(() => undefined);
});

describe('.nearest()', () => {

    it('returns the closest rows, nearest first', async () => {
        const result = await store.documents.nearest(x => x.embedding, [1, 0], 3).toArrayAsync();

        expect(result.map(x => x.title)).toEqual(['east', 'northeast', 'north']);
    });

    it('honours the count', async () => {
        const result = await store.documents.nearest(x => x.embedding, [0, 1], 2).toArrayAsync();

        expect(result.map(x => x.title)).toEqual(['north', 'northeast']);
    });

    it('orders from the query vector, not from a fixed point', async () => {
        // Same rows, opposite query: the order must invert rather than stay put, which is
        // what a translator that passed the data through would produce.
        const result = await store.documents.nearest(x => x.embedding, [-1, 0], 4).toArrayAsync();

        expect(result.map(x => x.title)).toEqual(['west', 'north', 'northeast', 'east']);
    });

    it('searches only what a preceding filter selected', async () => {
        const result = await store.documents
            .where(x => x.category === 'b')
            .nearest(x => x.embedding, [1, 0], 2)
            .toArrayAsync();

        expect(result.map(x => x.title)).toEqual(['northeast', 'west']);
    });

    it('applies a take AFTER the search rather than before it', async () => {
        // The regression this pins: a `take` pushed to the backend truncates rows the search
        // has not scored yet, so the answer is three real rows in a plausible order and not
        // the nearest three. Ordering everything by title first makes a
        // truncate-then-score bug produce 'east' at best and 'north' at worst.
        const result = await store.documents
            .sort(x => x.title)
            .nearest(x => x.embedding, [1, 0], 3)
            .take(2)
            .toArrayAsync();

        expect(result.map(x => x.title)).toEqual(['east', 'northeast']);
    });

    it('returns everything when asked for more than exists', async () => {
        const result = await store.documents.nearest(x => x.embedding, [1, 0], 100).toArrayAsync();

        expect(result).toHaveLength(4);
    });

    it('rejects a query vector of the wrong width at the call', async () => {
        expect(() => store.documents.nearest(x => x.embedding, [1, 0, 0], 3))
            .toThrow(/width/i);
    });

    it('rejects a property that is not a vector', async () => {
        expect(() => store.documents.nearest(x => x.title as never, [1, 0], 3))
            .toThrow(/vector property/i);
    });
});
