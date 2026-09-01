import { describe, it, expect } from '@jest/globals';
import { findIndexSeed, findSortSeed, seedableIndexes, seekReplacesPredicate, type IndexSeed } from './indexSeed';
import { s } from '@routier/core/schema';
import { toExpression } from '@routier/core/expressions';
import { QueryOrdering } from '@routier/core/plugins';

const schema = s.define('seedOrders', {
    _id: s.string().key().identity(),
    email: s.string().index(),
    status: s.string('pending', 'paid').index('idx_status'),
    region: s.string('na', 'eu').index('idx_region_amount'),
    amount: s.number().index('idx_region_amount'),
    score: s.number().index(),
    flagged: s.boolean().index(),
    sku: s.string().distinct(),
    warehouse: s.string().index('idx_warehouse_bin').distinct(),
    bin: s.string().index('idx_warehouse_bin'),
    notes: s.string(),
    nickname: s.string().index().nullable(),
    label: s.string().index().optional(),
    createdAt: s.date().index(),
    meta: s.object({ nested: s.string().index() }),
}).compile();

const compositeSchema = s.define('seedComposite', {
    a: s.string().key(),
    b: s.string().key(),
    name: s.string().index(),
}).compile();

const parse = <T extends {}>(target: typeof schema | typeof compositeSchema, filter: (args: [any, any]) => boolean, params?: T) =>
    toExpression(target as never, filter as never, params as never);

const indexes = seedableIndexes(schema);
const compositeIndexes = seedableIndexes(compositeSchema);

const seedOf = (filter: (args: [any, any]) => boolean, params?: {}) => findIndexSeed(parse(schema, filter, params), indexes);

describe('seedableIndexes', () => {
    it('includes bare .index(), .distinct(), and a single primary key', () => {
        expect(indexes.names.has('email')).toBe(true);
        expect(indexes.names.has('status')).toBe(true);
        expect(indexes.names.has('sku')).toBe(true);
        expect(indexes.names.has('_id')).toBe(true);
    });

    it('excludes undeclared, compound-grouped, nested, and composite-key properties', () => {
        expect(indexes.names.has('notes')).toBe(false);
        expect(indexes.names.has('region')).toBe(false);
        expect(indexes.names.has('amount')).toBe(false);
        expect(indexes.names.has('nested')).toBe(false);
        expect(indexes.names.has('warehouse')).toBe(false);
        expect(compositeIndexes.names.has('a')).toBe(false);
        expect(compositeIndexes.names.has('name')).toBe(true);
    });

    it('lists compound groups in stores-string member order', () => {
        expect(indexes.compoundGroups).toEqual([['region', 'amount'], ['warehouse', 'bin']]);
    });
});

describe('findIndexSeed equality', () => {
    it('seeds a strict equality on a declared single index', () => {
        expect(seedOf(([x, p]) => x.status === p.s, { s: 'paid' }))
            .toEqual({ kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: true });
    });

    it('seeds from either side of the comparison', () => {
        expect(seedOf(([x, p]) => p.s === x.status, { s: 'paid' }))
            .toEqual({ kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: true });
    });

    it('seeds one conjunct of an AND chain and reports partial coverage', () => {
        expect(seedOf(([x, p]) => x.notes === p.n && x.status === p.s, { n: 'x', s: 'paid' }))
            .toEqual({ kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: false });
    });

    it('refuses an undeclared property even though Dexie auto-indexes it', () => {
        expect(seedOf(([x, p]) => x.notes === p.n, { n: 'x' })).toBeNull();
    });

    it('refuses a lone equality on a property whose only declared index is compound', () => {
        expect(seedOf(([x, p]) => x.region === p.r, { r: 'eu' })).toBeNull();
    });

    it('refuses negated and non-strict equality', () => {
        expect(seedOf(([x, p]) => x.status !== p.s, { s: 'paid' })).toBeNull();
        // oxlint-disable-next-line eqeqeq
        expect(seedOf(([x, p]) => x.status == p.s, { s: 'paid' })).toBeNull();
    });

    it('refuses boolean, null, and NaN values, which IndexedDB cannot key', () => {
        expect(seedOf(([x, p]) => x.flagged === p.f, { f: true })).toBeNull();
        expect(seedOf(([x, p]) => x.email === p.e, { e: null as unknown as string })).toBeNull();
        expect(seedOf(([x, p]) => x.score === p.v, { v: NaN })).toBeNull();
    });

    it('refuses a Date value, because rows store dates as ISO strings that a Date key never matches', () => {
        expect(seedOf(([x, p]) => x.createdAt === p.d, { d: new Date(2026, 0, 1) })).toBeNull();
        expect(seedOf(([x, p]) => x.createdAt >= p.d, { d: new Date(2026, 0, 1) })).toBeNull();
    });

    it('seeds a single primary key but never a composite key component', () => {
        const onComposite = parse(compositeSchema, ([x, p]) => x.a === p.id, { id: 'abc' });

        expect(seedOf(([x, p]) => x._id === p.id, { id: 'abc' }))
            .toEqual({ kind: 'equals', indexName: '_id', value: 'abc', coversWholeFilter: true });
        expect(findIndexSeed(onComposite, compositeIndexes)).toBeNull();
    });

    it('returns null for a not-parsable expression', () => {
        expect(seedOf(([x, p]) => Math.abs(x.score - p.v) < 1, { v: 10 })).toBeNull();
    });
});

describe('findIndexSeed compound', () => {
    it('seeds the compound entry when every member has an equality', () => {
        expect(seedOf(([x, p]) => x.amount === p.a && x.region === p.r, { a: 5, r: 'eu' }))
            .toEqual({ kind: 'compound', indexName: '[region+amount]', values: ['eu', 5], coversWholeFilter: true });
    });

    it('prefers the compound entry over a single equality and reports the leftover conjunct', () => {
        expect(seedOf(([x, p]) => x.status === p.s && x.region === p.r && x.amount === p.a, { s: 'paid', r: 'eu', a: 5 }))
            .toEqual({ kind: 'compound', indexName: '[region+amount]', values: ['eu', 5], coversWholeFilter: false });
    });

    it('falls back to a single equality when a member is missing', () => {
        expect(seedOf(([x, p]) => x.status === p.s && x.region === p.r, { s: 'paid', r: 'eu' }))
            .toEqual({ kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: false });
    });
});

describe('findIndexSeed anyOf', () => {
    it('seeds an OR chain of equalities on one indexed property', () => {
        expect(seedOf(([x, p]) => x.status === p.a || x.status === p.b, { a: 'paid', b: 'pending' }))
            .toEqual({ kind: 'anyOf', indexName: 'status', values: ['paid', 'pending'], coversWholeFilter: true });
    });

    it('seeds an OR conjunct inside an AND chain', () => {
        expect(seedOf(([x, p]) => x.notes === p.n && (x.status === p.a || x.status === p.b), { n: 'x', a: 'paid', b: 'pending' }))
            .toEqual({ kind: 'anyOf', indexName: 'status', values: ['paid', 'pending'], coversWholeFilter: false });
    });

    it('refuses an OR across two properties or with a non-equality leaf', () => {
        expect(seedOf(([x, p]) => x.status === p.s || x.email === p.e, { s: 'paid', e: 'a@b.c' })).toBeNull();
        expect(seedOf(([x, p]) => x.score === p.a || x.score > p.b, { a: 1, b: 5 })).toBeNull();
    });
});

describe('findIndexSeed range', () => {
    it('seeds a single bound with the matching inclusivity', () => {
        expect(seedOf(([x, p]) => x.score > p.v, { v: 10 }))
            .toEqual({ kind: 'range', indexName: 'score', lower: { value: 10, inclusive: false }, upper: null, coversWholeFilter: true });
        expect(seedOf(([x, p]) => x.score <= p.v, { v: 10 }))
            .toEqual({ kind: 'range', indexName: 'score', lower: null, upper: { value: 10, inclusive: true }, coversWholeFilter: true });
    });

    it('swaps the comparator when the property is on the right', () => {
        expect(seedOf(([x, p]) => p.v < x.score, { v: 10 }))
            .toEqual({ kind: 'range', indexName: 'score', lower: { value: 10, inclusive: false }, upper: null, coversWholeFilter: true });
    });

    it('combines a lower and an upper bound on one property into a between', () => {
        expect(seedOf(([x, p]) => x.score >= p.lo && x.score < p.hi, { lo: 1, hi: 5 }))
            .toEqual({ kind: 'range', indexName: 'score', lower: { value: 1, inclusive: true }, upper: { value: 5, inclusive: false }, coversWholeFilter: true });
    });

    it('reports partial coverage when another conjunct remains', () => {
        expect(seedOf(([x, p]) => x.score > p.v && x.notes === p.n, { v: 10, n: 'x' }))
            .toEqual({ kind: 'range', indexName: 'score', lower: { value: 10, inclusive: false }, upper: null, coversWholeFilter: false });
    });

    it('prefers an equality over a range in the same chain', () => {
        expect(seedOf(([x, p]) => x.score > p.v && x.status === p.s, { v: 10, s: 'paid' }))
            .toEqual({ kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: false });
    });

    it('refuses a range on an undeclared or compound-only property', () => {
        expect(seedOf(([x, p]) => x.amount > p.v, { v: 10 })).toBeNull();
    });
});

describe('seekReplacesPredicate', () => {
    it('drops the predicate only when the seek consumed every conjunct', () => {
        const seed: IndexSeed = { kind: 'equals', indexName: 'status', value: 'paid', coversWholeFilter: true };

        expect(seekReplacesPredicate(seed)).toBe(true);
        expect(seekReplacesPredicate({ ...seed, coversWholeFilter: false })).toBe(false);
    });
});

describe('findSortSeed', () => {
    const sortOn = (name: string, direction: QueryOrdering = QueryOrdering.Ascending) =>
        findSortSeed({ selector: () => null as never, direction, propertyName: name, property: schema.getProperty(name) as never }, indexes);

    it('seeds an indexed, non-nullable string, number, or Date property', () => {
        expect(sortOn('score', QueryOrdering.Descending)).toEqual({ indexName: 'score', direction: 'desc' });
        expect(sortOn('createdAt')).toEqual({ indexName: 'createdAt', direction: 'asc' });
        expect(sortOn('_id')).toEqual({ indexName: '_id', direction: 'asc' });
    });

    it('refuses nullable, optional, boolean, undeclared, and compound-only properties', () => {
        expect(sortOn('nickname')).toBeNull();
        expect(sortOn('label')).toBeNull();
        expect(sortOn('flagged')).toBeNull();
        expect(sortOn('notes')).toBeNull();
        expect(sortOn('amount')).toBeNull();
    });
});
