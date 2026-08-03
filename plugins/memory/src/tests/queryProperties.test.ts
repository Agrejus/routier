import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '../MemoryPlugin';

/**
 * Property-based differential testing for query translation.
 *
 * The fixed query oracle covers a hand-chosen corpus. This covers the same ground with
 * generated predicates over generated entities, so the inputs are not limited to cases
 * someone thought to write down. Each property compares the query path against the same
 * predicate applied with plain `Array.prototype.filter`.
 *
 * Predicates are built as real arrow-function *source* and evaluated into closures, because
 * the parser reads a function's source text — a closure assembled by composition would not
 * present the syntax the parser is meant to handle.
 */

const schema = s.define('prop_rows', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    quantity: s.number(),
}).compile();

class PropertyDataStore extends DataStore {
    rows = this.collection(schema).create();
}

type Row = { name: string; category: string; price: number; quantity: number };

const NUMERIC_FIELDS = ['price', 'quantity'] as const;
const STRING_FIELDS = ['name', 'category'] as const;
const NUMERIC_COMPARATORS = ['>', '>=', '<', '<=', '===', '!=='] as const;
const STRING_COMPARATORS = ['===', '!=='] as const;

/** A leaf comparison, as source text. */
const leafArbitrary = fc.oneof(
    fc.record({
        field: fc.constantFrom(...NUMERIC_FIELDS),
        comparator: fc.constantFrom(...NUMERIC_COMPARATORS),
        // Values drawn from and around the seeded range so predicates are rarely vacuous.
        value: fc.integer({ min: -5, max: 45 }),
    }).map(({ field, comparator, value }) => `r.${field} ${comparator} ${value}`),
    fc.record({
        field: fc.constantFrom(...STRING_FIELDS),
        comparator: fc.constantFrom(...STRING_COMPARATORS),
        value: fc.constantFrom('fruit', 'dry', 'melon', 'apple', 'Fig', 'missing'),
    }).map(({ field, comparator, value }) => `r.${field} ${comparator} ${JSON.stringify(value)}`),
);

/** Combines leaves with && and || to a bounded depth. */
const predicateSourceArbitrary: fc.Arbitrary<string> = fc.letrec<{ node: string }>(tie => ({
    node: fc.oneof(
        { maxDepth: 2, depthSize: 'small' },
        leafArbitrary,
        fc.tuple(tie('node'), fc.constantFrom('&&', '||'), tie('node'))
            .map(([left, operator, right]) => `(${left}) ${operator} (${right})`),
    ),
})).node;

/** Turns predicate source into a real arrow function with that source text. */
function toPredicate(source: string): (r: any) => boolean {
    // eslint-disable-next-line no-new-func
    return new Function(`return (r) => ${source};`)() as (r: any) => boolean;
}

const rowArbitrary: fc.Arbitrary<Row> = fc.record({
    name: fc.constantFrom('apple', 'Banana', 'cherry', 'Date', 'elderberry', 'Fig', 'grape', 'Honeydew'),
    category: fc.constantFrom('fruit', 'dry', 'melon'),
    price: fc.integer({ min: 0, max: 40 }),
    quantity: fc.integer({ min: 0, max: 9 }),
});

const project = (rows: any[]): Row[] =>
    rows.map(r => ({ name: r.name, category: r.category, price: r.price, quantity: r.quantity }));

/** Order-insensitive comparison key — no ordering is requested by these properties. */
const asMultiset = (rows: Row[]) =>
    rows.map(r => `${r.name}|${r.category}|${r.price}|${r.quantity}`).sort();

describe('query properties (fast-check)', () => {
    let dataStore: PropertyDataStore;
    let seededRows: Row[];

    beforeAll(async () => {
        // One fixed data set, generated once with a fixed seed, shared by every property.
        // Reseeding the store per case would dominate runtime without adding coverage: the
        // properties vary the predicate, and the data set is already varied.
        seededRows = fc.sample(rowArbitrary, { numRuns: 40, seed: 424242 });

        dataStore = new PropertyDataStore(new MemoryPlugin(`prop-${uuidv4()}`));
        await dataStore.rows.addAsync(...(seededRows as any));
        await dataStore.saveChangesAsync();
    });

    afterAll(async () => {
        await dataStore?.destroyAsync().catch(() => undefined);
    });

    it('filters identically to Array.prototype.filter for generated predicates', async () => {
        await fc.assert(
            fc.asyncProperty(predicateSourceArbitrary, async source => {
                const predicate = toPredicate(source);

                const actual = project(await (dataStore.rows as any).where(predicate).toArrayAsync());
                const expected = seededRows.filter(predicate);

                expect(asMultiset(actual)).toEqual(asMultiset(expected));
            }),
            { numRuns: 250 },
        );
    });

    it('counts identically to the reference for generated predicates', async () => {
        await fc.assert(
            fc.asyncProperty(predicateSourceArbitrary, async source => {
                const predicate = toPredicate(source);

                const actual = await (dataStore.rows as any).where(predicate).countAsync();

                expect(actual).toBe(seededRows.filter(predicate).length);
            }),
            { numRuns: 150 },
        );
    });

    it('agrees with the reference on whether any row matches', async () => {
        await fc.assert(
            fc.asyncProperty(predicateSourceArbitrary, async source => {
                const predicate = toPredicate(source);

                const actual = await (dataStore.rows as any).someAsync(predicate);

                expect(actual).toBe(seededRows.some(predicate));
            }),
            { numRuns: 150 },
        );
    });

    it('returns a subset of the seeded rows for every predicate', async () => {
        const seeded = new Set(asMultiset(seededRows));

        await fc.assert(
            fc.asyncProperty(predicateSourceArbitrary, async source => {
                const actual = project(await (dataStore.rows as any).where(toPredicate(source)).toArrayAsync());

                // Independent of the reference: a filter must never invent a row. This still
                // holds if the reference implementation and the query are wrong in the same
                // way, which the differential properties above cannot rule out.
                for (const key of asMultiset(actual)) {
                    expect(seeded.has(key)).toBe(true);
                }
            }),
            { numRuns: 150 },
        );
    });

    it('returns complementary result sets for a predicate and its negation', async () => {
        await fc.assert(
            fc.asyncProperty(predicateSourceArbitrary, async source => {
                const matching = project(await (dataStore.rows as any).where(toPredicate(source)).toArrayAsync());
                const negated = project(await (dataStore.rows as any).where(toPredicate(`!(${source})`)).toArrayAsync());

                // A metamorphic property: whatever the predicate means, it and its negation
                // must partition the rows. This catches a filter that silently drops rows,
                // which a differential check against an equally-wrong reference would miss.
                expect(matching.length + negated.length).toBe(seededRows.length);
            }),
            { numRuns: 120 },
        );
    });
});
