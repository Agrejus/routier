import { describe, it, expect } from '@jest/globals';
import { findIndexSeed } from './indexSeed';
import { s } from '@routier/core/schema';
import { toExpression } from '@routier/core/expressions';

const schema = s.define('seedOrders', {
    _id: s.string().key().identity(),
    email: s.string(),
    status: s.string('pending', 'paid'),
    amount: s.number(),
    active: s.boolean(),
    createdAt: s.date(),
    meta: s.object({ nested: s.string() }),
}).compile();

const compositeSchema = s.define('seedComposite', {
    a: s.string().key(),
    b: s.string().key(),
    name: s.string(),
}).compile();

const parse = <T extends {}>(target: typeof schema | typeof compositeSchema, filter: (args: [any, any]) => boolean, params?: T) =>
    toExpression(target as never, filter as never, params as never);

const single = { compositeKey: false };
const composite = { compositeKey: true };

describe('findIndexSeed', () => {
    it('seeds a strict equality on an indexed root property', () => {
        const expression = parse(schema, ([x, p]) => x.status === p.s, { s: 'paid' });

        expect(findIndexSeed(expression, single)).toEqual({ indexName: 'status', value: 'paid', coversWholeFilter: true });
    });

    it('seeds from either side of the comparison', () => {
        const expression = parse(schema, ([x, p]) => p.s === x.status, { s: 'paid' });

        expect(findIndexSeed(expression, single)).toEqual({ indexName: 'status', value: 'paid', coversWholeFilter: true });
    });

    it('seeds one conjunct of an AND chain and reports partial coverage', () => {
        const expression = parse(schema, ([x, p]) => x.status === p.s && x.amount > p.v, { s: 'paid', v: 10 });

        const seed = findIndexSeed(expression, single);
        expect(seed).toEqual({ indexName: 'status', value: 'paid', coversWholeFilter: false });
    });

    it('refuses an OR expression', () => {
        const expression = parse(schema, ([x, p]) => x.status === p.s || x.amount > p.v, { s: 'paid', v: 10 });

        expect(findIndexSeed(expression, single)).toBeNull();
    });

    it('refuses negated and non-strict equality', () => {
        const negated = parse(schema, ([x, p]) => x.status !== p.s, { s: 'paid' });
        // oxlint-disable-next-line eqeqeq
        const loose = parse(schema, ([x, p]) => x.status == p.s, { s: 'paid' });

        expect(findIndexSeed(negated, single)).toBeNull();
        expect(findIndexSeed(loose, single)).toBeNull();
    });

    it('refuses boolean and null values, which IndexedDB cannot index', () => {
        const bool = parse(schema, ([x, p]) => x.active === p.a, { a: true });
        const nul = parse(schema, ([x, p]) => x.email === p.e, { e: null as unknown as string });

        expect(findIndexSeed(bool, single)).toBeNull();
        expect(findIndexSeed(nul, single)).toBeNull();
    });

    it('refuses nested properties', () => {
        const expression = parse(schema, ([x, p]) => x.meta.nested === p.n, { n: 'v' });

        expect(findIndexSeed(expression, single)).toBeNull();
    });

    it('seeds a single primary key but never a composite key component', () => {
        const onKey = parse(schema, ([x, p]) => x._id === p.id, { id: 'abc' });
        const onComposite = parse(compositeSchema, ([x, p]) => x.a === p.id, { id: 'abc' });

        expect(findIndexSeed(onKey, single)).toEqual({ indexName: '_id', value: 'abc', coversWholeFilter: true });
        expect(findIndexSeed(onComposite, composite)).toBeNull();
    });

    it('seeds a non-key property on a composite-key schema', () => {
        const expression = parse(compositeSchema, ([x, p]) => x.name === p.n, { n: 'row' });

        expect(findIndexSeed(expression, composite)).toEqual({ indexName: 'name', value: 'row', coversWholeFilter: true });
    });

    it('returns null for a not-parsable expression', () => {
        const expression = parse(schema, ([x, p]) => Math.abs(x.amount - p.v) < 1, { v: 10 });

        expect(findIndexSeed(expression, single)).toBeNull();
    });
});
