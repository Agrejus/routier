import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

/**
 * Every syntactic form the expression parser supports, exercised end to end and compared
 * against the same predicate applied with `Array.prototype.filter`.
 *
 * Written to kill surviving mutants from `npm run mutate:expressions`. Behavioral rather
 * than structural on purpose: asserting the shape of a parsed tree encodes assumptions about
 * internals that may be wrong, while a mutated parser that builds the wrong tree returns the
 * wrong rows, which is unambiguous. The reference is plain JS, so a mutant has to survive
 * both the parser and the comparison.
 *
 * The clusters targeted:
 *   parser.ts:45  — MULTI_CHARACTER_PUNCTUATION, one mutant per operator string
 *   parser.ts:88  — block comment skipping
 *   parser.ts:111 — template literal interpolation rejection
 *   parser.ts:132 — numeric literals with decimals
 *   parser.ts:666 — transform method calls
 *   parser.ts:686 — methodCall compared to a boolean
 *   parser.ts:704 — comparator swapping when the property is on the right
 *   parser.ts:719 — truthy shorthand
 */

const schema = s.define('filter_forms', {
    _id: s.string().key().identity(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
    ratio: s.number(),
    active: s.boolean(),
}).compile();

class Store extends DataStore {
    rows = this.collection(schema).create();
}

type Row = { name: string; category: string; price: number; ratio: number; active: boolean };

const ROWS: Row[] = [
    { name: 'apple', category: 'fruit', price: 10, ratio: 1.5, active: true },
    { name: 'Banana', category: 'fruit', price: 30, ratio: 2.25, active: false },
    { name: 'cherry', category: 'dry', price: 20, ratio: 0.5, active: true },
    { name: 'Date', category: 'dry', price: 20, ratio: 3.75, active: false },
    { name: 'elderberry', category: 'melon', price: 0, ratio: 0.25, active: true },
];

let store: Store;

const project = (rows: any[]) => rows.map(r => r.name).sort();
const expected = (predicate: (r: Row) => boolean) => ROWS.filter(predicate).map(r => r.name).sort();

beforeAll(async () => {
    store = new Store(new MemoryPlugin('filter-forms'));
    await store.rows.addAsync(...(ROWS as any));
    await store.saveChangesAsync();
});

afterAll(async () => {
    await store?.destroyAsync().catch(() => undefined);
});

/** Runs a filter through the query path and asserts it matches the JS reference. */
async function assertMatches(query: (r: any) => boolean, reference: (r: Row) => boolean) {
    expect(project(await store.rows.where(query).toArrayAsync())).toEqual(expected(reference));
}

describe('comparison operators', () => {
    // Each of these is a distinct entry in MULTI_CHARACTER_PUNCTUATION. Mutating any one
    // string to "" leaves the others intact, so every operator needs its own case.
    it('===', () => assertMatches(r => r.price === 20, r => r.price === 20));
    it('!==', () => assertMatches(r => r.price !== 20, r => r.price !== 20));
    it('>=', () => assertMatches(r => r.price >= 20, r => r.price >= 20));
    it('<=', () => assertMatches(r => r.price <= 20, r => r.price <= 20));
    it('>', () => assertMatches(r => r.price > 20, r => r.price > 20));
    it('<', () => assertMatches(r => r.price < 20, r => r.price < 20));

    // `==` and `!=` must not be swallowed by the longer `===`/`!==` entries. The table is
    // ordered longest-first precisely so the prefixes do not win; that ordering is what
    // these two cases pin.
    // eslint-disable-next-line eqeqeq
    it('==', () => assertMatches(r => r.price == 20, r => r.price === 20));
    // eslint-disable-next-line eqeqeq
    it('!=', () => assertMatches(r => r.price != 20, r => r.price !== 20));
});

describe('logical operators', () => {
    it('&&', () => assertMatches(
        r => r.category === 'fruit' && r.price > 15,
        r => r.category === 'fruit' && r.price > 15,
    ));

    it('||', () => assertMatches(
        r => r.category === 'melon' || r.price > 25,
        r => r.category === 'melon' || r.price > 25,
    ));

    it('mixed && and ||, precedence preserved', () => assertMatches(
        r => r.category === 'fruit' && r.price > 15 || r.category === 'melon',
        r => r.category === 'fruit' && r.price > 15 || r.category === 'melon',
    ));

    it('parenthesised grouping overrides precedence', () => assertMatches(
        r => r.category === 'fruit' && (r.price > 15 || r.active === true),
        r => r.category === 'fruit' && (r.price > 15 || r.active === true),
    ));

    it('negation of a group', () => assertMatches(
        r => !(r.category === 'fruit'),
        r => !(r.category === 'fruit'),
    ));
});

describe('boolean forms', () => {
    it('explicit === true', () => assertMatches(r => r.active === true, r => r.active === true));

    // `false` is the value a truthiness-based translation silently mishandles.
    it('explicit === false', () => assertMatches(r => r.active === false, r => r.active === false));

    // Truthy shorthand: `r.active` must become `active === true` rather than being dropped.
    it('truthy shorthand', () => assertMatches(r => r.active, r => r.active));

    it('negated shorthand', () => assertMatches(r => !r.active, r => !r.active));
});

describe('numeric literals', () => {
    it('integer', () => assertMatches(r => r.price === 10, r => r.price === 10));

    // Decimal parsing is a separate branch from integer parsing.
    it('decimal', () => assertMatches(r => r.ratio === 1.5, r => r.ratio === 1.5));

    it('decimal comparison', () => assertMatches(r => r.ratio > 2.0, r => r.ratio > 2.0));

    it('zero', () => assertMatches(r => r.price === 0, r => r.price === 0));

    it('negative literal', () => assertMatches(r => r.price > -1, r => r.price > -1));
});

describe('operand order', () => {
    // The property is on the right, so the comparator has to be swapped rather than
    // applied as written. `20 < price` means `price > 20`, and getting the swap wrong
    // inverts the result set without erroring.
    it('value on the left with <', () => assertMatches(r => 20 < r.price, r => 20 < r.price));
    it('value on the left with >', () => assertMatches(r => 20 > r.price, r => 20 > r.price));
    it('value on the left with <=', () => assertMatches(r => 20 <= r.price, r => 20 <= r.price));
    it('value on the left with >=', () => assertMatches(r => 20 >= r.price, r => 20 >= r.price));
    it('value on the left with ===', () => assertMatches(r => 20 === r.price, r => 20 === r.price));
});

describe('string transform methods', () => {
    it('startsWith', () => assertMatches(
        r => r.name.startsWith('a'),
        r => r.name.startsWith('a'),
    ));

    it('endsWith', () => assertMatches(
        r => r.name.endsWith('y'),
        r => r.name.endsWith('y'),
    ));

    it('includes', () => assertMatches(
        r => r.name.includes('err'),
        r => r.name.includes('err'),
    ));

    it('toLowerCase in a comparison', () => assertMatches(
        r => r.name.toLowerCase() === 'banana',
        r => r.name.toLowerCase() === 'banana',
    ));

    it('toUpperCase in a comparison', () => assertMatches(
        r => r.name.toUpperCase() === 'APPLE',
        r => r.name.toUpperCase() === 'APPLE',
    ));

    // A method call compared to a boolean folds into negation rather than becoming a
    // comparison against `true`/`false`. Both polarities are needed: the fold reads the
    // literal, so a mutant flipping it only shows up on one side.
    it('method call === true', () => assertMatches(
        r => r.name.startsWith('a') === true,
        r => r.name.startsWith('a') === true,
    ));

    it('method call === false', () => assertMatches(
        r => r.name.startsWith('a') === false,
        r => r.name.startsWith('a') === false,
    ));

    it('negated method call', () => assertMatches(
        r => !r.name.startsWith('a'),
        r => !r.name.startsWith('a'),
    ));

    it('method call combined with another condition', () => assertMatches(
        r => r.name.startsWith('a') && r.price > 5,
        r => r.name.startsWith('a') && r.price > 5,
    ));
});

describe('parameterised filters', () => {
    it('compares against a param value', async () => {
        const found = await store.rows
            .where(([r, p]) => r.price > p.min, { min: 15 })
            .toArrayAsync();

        expect(project(found)).toEqual(expected(r => r.price > 15));
    });

    it('reads a nested param path', async () => {
        const found = await store.rows
            .where(([r, p]) => r.price > p.range.min, { range: { min: 15 } })
            .toArrayAsync();

        expect(project(found)).toEqual(expected(r => r.price > 15));
    });

    it('uses more than one param', async () => {
        const found = await store.rows
            .where(([r, p]) => r.price >= p.min && r.price <= p.max, { min: 10, max: 20 })
            .toArrayAsync();

        expect(project(found)).toEqual(expected(r => r.price >= 10 && r.price <= 20));
    });

    it('uses a string param', async () => {
        const found = await store.rows
            .where(([r, p]) => r.category === p.category, { category: 'dry' })
            .toArrayAsync();

        expect(project(found)).toEqual(expected(r => r.category === 'dry'));
    });

    it('uses a boolean param, including false', async () => {
        const found = await store.rows
            .where(([r, p]) => r.active === p.wanted, { wanted: false })
            .toArrayAsync();

        expect(project(found)).toEqual(expected(r => r.active === false));
    });
});

describe('comments and whitespace in filter source', () => {
    /** Builds a predicate whose source text is exactly `source`. */
    const fromSource = (source: string) => new Function(`return (r) => ${source};`)() as (r: any) => boolean;

    it('ignores a line comment', () => assertMatches(
        fromSource('r.price > 15 // only the expensive ones'),
        r => r.price > 15,
    ));

    it('ignores a block comment between tokens', () => assertMatches(
        fromSource('r.price /* the price */ > 15'),
        r => r.price > 15,
    ));

    it('ignores a block comment spanning lines', () => assertMatches(
        fromSource('r.price >\n/*\n multi\n line\n*/\n15'),
        r => r.price > 15,
    ));

    it('ignores a comment containing operator characters', () => assertMatches(
        // The comment body holds `&&` and `===`; a tokenizer that fails to skip comments
        // would try to parse them.
        fromSource('r.price > 15 /* not && a === real operator */'),
        r => r.price > 15,
    ));
});

describe('string literals', () => {
    const fromSource = (source: string) => new Function(`return (r) => ${source};`)() as (r: any) => boolean;

    it('double-quoted', () => assertMatches(fromSource('r.category === "dry"'), r => r.category === 'dry'));
    it('single-quoted', () => assertMatches(fromSource("r.category === 'dry'"), r => r.category === 'dry'));
    it('template literal without interpolation', () => assertMatches(
        fromSource('r.category === `dry`'),
        r => r.category === 'dry',
    ));

    it('string containing an escaped quote', async () => {
        // Parsing must consume the escape rather than ending the literal early.
        const found = await store.rows.where(fromSource('r.name === "no\\"such"')).toArrayAsync();
        expect(found).toEqual([]);
    });

    it('string containing operator characters', async () => {
        const found = await store.rows.where(fromSource('r.category === "a && b === c"')).toArrayAsync();
        expect(found).toEqual([]);
    });
});
