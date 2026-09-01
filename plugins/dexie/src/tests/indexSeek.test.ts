import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuidv4 } from '@routier/core';
import { executedQueriesOf } from '@routier/core/plugins';
import { DataStore } from '@routier/datastore';
import { DexiePlugin } from '../DexiePlugin';

const orderSchema = s.define('seek_orders', {
    _id: s.string().key().identity(),
    email: s.string().distinct(),
    status: s.string('pending', 'paid', 'shipped').index(),
    region: s.string('na', 'eu').index('idx_region_amount'),
    amount: s.number().index('idx_region_amount'),
    score: s.number().index(),
    notes: s.string(),
    nickname: s.string().index().nullable(),
    createdAt: s.date().index(),
}).compile();

class SeekStore extends DataStore {
    orders = this.collection(orderSchema).proxy().create();
}

const STATUSES = ['pending', 'paid', 'shipped'] as const;
const ROWS = 30;

const seekOn = (name: string) => `seek_orders.where("${name}").equals(?) — IndexedDB index seek`;

describe('Dexie index seek', () => {
    const store = new SeekStore(new DexiePlugin(`seek-${uuidv4()}`));

    beforeAll(async () => {
        for (let i = 0; i < ROWS; i++) {
            await store.orders.addAsync({
                email: `user${i}@example.com`,
                status: STATUSES[i % 3],
                region: i % 2 === 0 ? 'na' : 'eu',
                amount: i,
                score: (i * 7) % ROWS,
                notes: `note ${i % 5}`,
                nickname: i % 4 === 0 ? null : `nick${i}`,
                createdAt: new Date(2026, 0, 1 + i),
            });
        }
        await store.saveChangesAsync();
    });

    afterAll(async () => {
        await store.destroyAsync();
    });

    it('answers a whole-filter equality from the index alone, without a JavaScript predicate', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'paid' })
            .explain()
            .toArrayAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data.map(x => x.amount).sort((a, b) => a - b)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
        expect(data.every(x => x.status === 'paid')).toBe(true);
        expect(query.text).toBe(seekOn('status'));
        expect(query.parameters).toEqual(['paid']);
    });

    it('pushes skip and take down to Dexie once the seek replaces the only filter', async () => {
        const all = await store.orders.where(([x, p]) => x.status === p.s, { s: 'paid' }).toArrayAsync();

        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'paid' })
            .skip(2)
            .take(3)
            .explain()
            .toArrayAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data.map(x => x._id)).toEqual(all.slice(2, 5).map(x => x._id));
        expect(query.text).toBe(`${seekOn('status')}.offset(…).limit(…)`);
    });

    it('finds one row by a distinct property with a limit on the seek', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.email === p.e, { e: 'user7@example.com' })
            .explain()
            .firstOrUndefinedAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data?.amount).toBe(7);
        expect(query.text).toBe(`${seekOn('email')}.limit(…)`);
    });

    it('keeps the residual predicate over the seeked rows for a compound filter', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s && x.amount > p.min, { s: 'paid', min: 15 })
            .explain()
            .toArrayAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data.map(x => x.amount).sort((a, b) => a - b)).toEqual([16, 19, 22, 25, 28]);
        expect(query.text).toContain(seekOn('status'));
        expect(query.text).toContain('JavaScript predicate over the seeked rows');
        expect(query.text).not.toContain('offset');
        expect(query.parameters).toEqual(['paid', 'paid', 15]);
    });

    it('counts on the index without loading rows', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'shipped' })
            .explain()
            .countAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data).toBe(10);
        expect(query.text).toBe(`${seekOn('status')}.count()`);
    });

    it('counts a whole table and a predicate-filtered walk in Dexie', async () => {
        const whole = await store.orders.explain().countAsync();
        const walked = await store.orders
            .where(([x, p]) => x.notes === p.n, { n: 'note 0' })
            .explain()
            .countAsync();

        expect(whole.data).toBe(ROWS);
        expect(executedQueriesOf(whole.explanation)[0].text).toBe('seek_orders.toCollection().count()');
        expect(walked.data).toBe(6);
        expect(executedQueriesOf(walked.explanation)[0].text).toContain('toCollection().filter(');
        expect(executedQueriesOf(walked.explanation)[0].text).toContain('.count()');
    });

    it('leaves count to the translator when a window is in the chain', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'paid' })
            .skip(8)
            .explain()
            .countAsync();

        expect(data).toBe(2);
        expect(executedQueriesOf(explanation)[0].text).not.toContain('count()');
    });

    it('windows in memory when a sort follows the seek', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'paid' })
            .sort(x => x.amount)
            .take(2)
            .explain()
            .toArrayAsync();

        expect(data.map(x => x.amount)).toEqual([1, 4]);
        expect(executedQueriesOf(explanation)[0].text).toBe(seekOn('status'));
    });

    it('walks the full cursor for a property only in a compound index', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.region === p.r, { r: 'eu' })
            .explain()
            .toArrayAsync();

        expect(data).toHaveLength(15);
        expect(executedQueriesOf(explanation)[0].text).toContain('seek_orders.toCollection().filter(');
    });

    it('seeks the compound entry when both members are fixed', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.region === p.r && x.amount === p.a, { r: 'eu', a: 7 })
            .explain()
            .toArrayAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data.map(x => x.amount)).toEqual([7]);
        expect(query.text).toBe('seek_orders.where("[region+amount]").equals([?, ?]) — IndexedDB index seek');
        expect(query.parameters).toEqual(['eu', 7]);
    });

    it('seeks with anyOf for an OR of equalities on one indexed property', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.a || x.status === p.b, { a: 'paid', b: 'shipped' })
            .explain()
            .toArrayAsync();

        const [query] = executedQueriesOf(explanation);

        expect(data).toHaveLength(20);
        expect(data.every(x => x.status !== 'pending')).toBe(true);
        expect(query.text).toBe('seek_orders.where("status").anyOf(?, ?) — 2 IndexedDB index seeks');
        expect(query.parameters).toEqual(['paid', 'shipped']);
    });

    it('counts and windows an anyOf seek correctly across its parts', async () => {
        const counted = await store.orders
            .where(([x, p]) => x.status === p.a || x.status === p.b, { a: 'shipped', b: 'paid' })
            .explain()
            .countAsync();
        const windowed = await store.orders
            .where(([x, p]) => x.status === p.a || x.status === p.b, { a: 'shipped', b: 'paid' })
            .skip(9)
            .take(3)
            .explain()
            .toArrayAsync();

        expect(counted.data).toBe(20);
        expect(executedQueriesOf(counted.explanation)[0].text).toContain('.count()');
        expect(windowed.data).toHaveLength(3);
        expect(windowed.data.map(x => x.status)).toEqual(['paid', 'shipped', 'shipped']);
        expect(executedQueriesOf(windowed.explanation)[0].text).not.toContain('offset');
    });

    it('seeks a range with above, below, and between, and drops the predicate', async () => {
        const above = await store.orders.where(([x, p]) => x.score > p.v, { v: 25 }).explain().toArrayAsync();
        const belowOrEqual = await store.orders.where(([x, p]) => x.score <= p.v, { v: 3 }).explain().toArrayAsync();
        const between = await store.orders.where(([x, p]) => x.score >= p.lo && x.score < p.hi, { lo: 10, hi: 14 }).explain().toArrayAsync();

        expect(above.data.map(x => x.score).sort((a, b) => a - b)).toEqual([26, 27, 28, 29]);
        expect(executedQueriesOf(above.explanation)[0].text).toBe('seek_orders.where("score").above(?) — IndexedDB index seek');
        expect(belowOrEqual.data.map(x => x.score).sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(executedQueriesOf(belowOrEqual.explanation)[0].text).toBe('seek_orders.where("score").belowOrEqual(?) — IndexedDB index seek');
        expect(between.data.map(x => x.score).sort((a, b) => a - b)).toEqual([10, 11, 12, 13]);
        expect(executedQueriesOf(between.explanation)[0].text).toBe('seek_orders.where("score").between(?, ?, true, false) — IndexedDB index seek');
        expect(executedQueriesOf(between.explanation)[0].parameters).toEqual([10, 14]);
    });

    it('returns nothing for an empty range instead of throwing', async () => {
        const data = await store.orders.where(([x, p]) => x.score > p.lo && x.score < p.hi, { lo: 20, hi: 10 }).toArrayAsync();

        expect(data).toEqual([]);
    });

    it('walks for a Date comparison, because stored dates are ISO strings a Date key cannot match', async () => {
        const { explanation } = await store.orders
            .where(([x, p]) => x.createdAt >= p.d, { d: new Date(2026, 0, 29) })
            .explain()
            .toArrayAsync();

        expect(executedQueriesOf(explanation)[0].text).toContain('seek_orders.toCollection().filter(');
    });

    it('orders by the index and windows in Dexie when there is no filter', async () => {
        const asc = await store.orders.sort(x => x.score).skip(3).take(4).explain().toArrayAsync();
        const desc = await store.orders.sortDescending(x => x.createdAt).take(2).explain().toArrayAsync();

        expect(asc.data.map(x => x.score)).toEqual([3, 4, 5, 6]);
        expect(executedQueriesOf(asc.explanation)[0].text).toBe('seek_orders.orderBy("score") — IndexedDB index walk in key order.offset(…).limit(…)');
        expect(desc.data.map(x => x.amount)).toEqual([29, 28]);
        expect(executedQueriesOf(desc.explanation)[0].text).toBe('seek_orders.orderBy("createdAt").reverse() — IndexedDB index walk in key order.limit(…)');
    });

    it('sorts in memory on a nullable property so null rows are not dropped', async () => {
        const { data, explanation } = await store.orders.sort(x => x.nickname).explain().toArrayAsync();

        expect(data).toHaveLength(ROWS);
        expect(data.slice(0, 8).every(x => x.nickname == null)).toBe(true);
        expect(executedQueriesOf(explanation)[0].text).toBe('seek_orders.toCollection()');
    });

    it('orders by the index and windows in Dexie with a residual predicate in front', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.notes === p.n, { n: 'note 1' })
            .sort(x => x.score)
            .skip(1)
            .take(3)
            .explain()
            .toArrayAsync();

        const expected = Array.from({ length: ROWS }, (_, i) => i).filter(i => i % 5 === 1).sort((a, b) => ((a * 7) % ROWS) - ((b * 7) % ROWS)).slice(1, 4);

        expect(data.map(x => x.amount)).toEqual(expected);
        expect(executedQueriesOf(explanation)[0].text).toBe('seek_orders.orderBy("score") — IndexedDB index walk in key order.filter(notes === ?) — JavaScript predicate over a full cursor walk, no index.offset(…).limit(…)');
    });

    it('windows matches, not table rows, when a predicate remains on a walk or a seek', async () => {
        const allWalked = await store.orders.where(([x, p]) => x.notes === p.n, { n: 'note 2' }).toArrayAsync();
        const allSeeked = await store.orders.where(([x, p]) => x.status === p.s && x.amount > p.min, { s: 'paid', min: 10 }).toArrayAsync();
        const walked = await store.orders
            .where(([x, p]) => x.notes === p.n, { n: 'note 2' })
            .skip(2)
            .take(2)
            .explain()
            .toArrayAsync();
        const seeked = await store.orders
            .where(([x, p]) => x.status === p.s && x.amount > p.min, { s: 'paid', min: 10 })
            .skip(1)
            .take(2)
            .explain()
            .toArrayAsync();

        expect(allWalked).toHaveLength(6);
        expect(walked.data.map(x => x._id)).toEqual(allWalked.slice(2, 4).map(x => x._id));
        expect(executedQueriesOf(walked.explanation)[0].text).toContain('.offset(…).limit(…)');
        expect(allSeeked).toHaveLength(6);
        expect(seeked.data.map(x => x._id)).toEqual(allSeeked.slice(1, 3).map(x => x._id));
        expect(executedQueriesOf(seeked.explanation)[0].text).toContain('JavaScript predicate over the seeked rows.offset(…).limit(…)');
    });

    it('sorts in memory when a seek is present', async () => {
        const { data, explanation } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'paid' })
            .sortDescending(x => x.score)
            .take(2)
            .explain()
            .toArrayAsync();

        const paidByScoreDesc = Array.from({ length: ROWS }, (_, i) => i).filter(i => i % 3 === 1).sort((a, b) => ((b * 7) % ROWS) - ((a * 7) % ROWS));

        expect(data.map(x => x.amount)).toEqual(paidByScoreDesc.slice(0, 2));
        expect(executedQueriesOf(explanation)[0].text).toBe(seekOn('status'));
    });

    it('sums over seeked rows through the translator', async () => {
        const { data } = await store.orders
            .where(([x, p]) => x.status === p.s, { s: 'pending' })
            .explain()
            .sumAsync(x => x.amount);

        expect(data).toBe(0 + 3 + 6 + 9 + 12 + 15 + 18 + 21 + 24 + 27);
    });
});
