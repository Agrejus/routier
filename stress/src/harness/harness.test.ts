import { describe, expect, it } from '@jest/globals';
import { MemoryTrace } from './memory';
import { Oracle, compareToOracle } from './oracle';
import { PollTimeoutError, pollUntil } from './poll';
import { Rng } from './rng';

/**
 * The harness tests itself, and unlike the scenarios it is NOT gated on STRESS=1.
 *
 * A stress scenario is only as trustworthy as the tooling that judges it. A leak detector
 * that never fires, or an oracle comparison that reports a match on divergent input, turns
 * the whole suite into a green light that means nothing — and because the scenarios take
 * minutes to run, nobody would notice. These are fast, so they run on every `npx jest`.
 */

describe('Rng', () => {
    it('produces the same sequence for the same seed', () => {
        const draw = () => {
            const rng = new Rng(1234);
            return [rng.next(), rng.next(), rng.next()];
        };

        expect(draw()).toEqual(draw());
    });

    it('produces different sequences for different seeds', () => {
        expect(new Rng(1).next()).not.toBe(new Rng(2).next());
    });

    it('keeps ints inside the requested range', () => {
        const rng = new Rng(99);
        const values = Array.from({ length: 500 }, () => rng.int(10));

        expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...values)).toBeLessThan(10);
    });

    it('samples without repeating a member', () => {
        const items = Array.from({ length: 20 }, (_, i) => i);
        const sampled = new Rng(7).sample(items, 8);

        expect(sampled).toHaveLength(8);
        expect(new Set(sampled).size).toBe(8);
    });

    it('caps a sample at the pool size instead of looping', () => {
        expect(new Rng(7).sample([1, 2, 3], 99)).toHaveLength(3);
    });
});

describe('Oracle comparison', () => {
    type Row = { id: string; value: number };
    const keyOf = (e: Row) => e.id;
    const build = (entities: Row[]) => {
        const oracle = new Oracle<Row>(keyOf);
        entities.forEach(e => oracle.set(e));
        return oracle;
    };

    it('matches identical sets', () => {
        const entities = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];

        expect(compareToOracle(build(entities), entities, keyOf, { fields: ['value'] }).matches).toBe(true);
    });

    it('reports an entity the database lost', () => {
        const comparison = compareToOracle(
            build([{ id: 'a', value: 1 }, { id: 'b', value: 2 }]),
            [{ id: 'a', value: 1 }],
            keyOf
        );

        expect(comparison.matches).toBe(false);
        expect(comparison.divergences).toContainEqual({ kind: 'missing', id: 'b' });
    });

    it('reports an entity the database invented', () => {
        const comparison = compareToOracle(build([{ id: 'a', value: 1 }]), [
            { id: 'a', value: 1 },
            { id: 'ghost', value: 9 },
        ], keyOf);

        expect(comparison.divergences).toContainEqual({ kind: 'unexpected', id: 'ghost' });
    });

    it('reports a duplicate id rather than silently deduplicating it', () => {
        // The whole point of the volume scenarios: an id collision must surface, and a
        // Set-based comparison would hide it.
        const comparison = compareToOracle(build([{ id: 'a', value: 1 }]), [
            { id: 'a', value: 1 },
            { id: 'a', value: 1 },
        ], keyOf);

        expect(comparison.matches).toBe(false);
        expect(comparison.divergences[0].detail).toBe('duplicate id in result set');
    });

    it('reports a field that changed value', () => {
        const comparison = compareToOracle(build([{ id: 'a', value: 1 }]), [{ id: 'a', value: 2 }], keyOf, {
            fields: ['value'],
        });

        expect(comparison.divergences[0]).toMatchObject({ kind: 'mismatch', id: 'a' });
    });

    it('ignores field values when no fields are requested', () => {
        expect(compareToOracle(build([{ id: 'a', value: 1 }]), [{ id: 'a', value: 2 }], keyOf).matches).toBe(true);
    });

    it('treats a Date and an equal foreign-realm Date as the same value', () => {
        // structuredClone inside Jest returns Dates that fail `instanceof Date`. Comparing
        // by getTime is the documented workaround; this pins that the oracle does it.
        type Dated = { id: string; at: Date };
        const at = new Date('2020-01-01T00:00:00.000Z');
        const foreign = structuredClone(at);
        const key = (e: Dated) => e.id;
        const oracle = new Oracle<Dated>(key);
        oracle.set({ id: 'a', at });

        expect(compareToOracle(oracle, [{ id: 'a', at: foreign }], key, { fields: ['at'] }).matches).toBe(true);
    });

    it('bounds the reported sample while still counting every divergence', () => {
        const oracle = build(Array.from({ length: 50 }, (_, i) => ({ id: `k${i}`, value: i })));
        const comparison = compareToOracle(oracle, [], keyOf, { sampleSize: 3 });

        expect(comparison.divergences).toHaveLength(3);
        expect(comparison.divergenceCount).toBe(50);
    });
});

describe('pollUntil', () => {
    it('resolves as soon as the condition holds', async () => {
        let calls = 0;

        const value = await pollUntil(() => ++calls, n => n >= 3, { describe: 'counter reaches 3', intervalMs: 1 });

        expect(value).toBe(3);
    });

    it('checks the condition once even with a zero deadline', async () => {
        await expect(pollUntil(() => 'ready', v => v === 'ready', { describe: 'ready', deadlineMs: 0 }))
            .resolves.toBe('ready');
    });

    it('reports the last observed value when the deadline passes', async () => {
        const error: PollTimeoutError = await pollUntil(() => 41, n => n === 42, {
            describe: 'answer reaches 42',
            deadlineMs: 30,
            intervalMs: 5,
        }).then(
            () => { throw new Error('expected pollUntil to time out'); },
            e => e as PollTimeoutError
        );

        expect(error).toBeInstanceOf(PollTimeoutError);
        expect(error.lastObserved).toBe(41);
        expect(error.message).toContain('answer reaches 42');
        expect(error.message).toContain('last observed: 41');
    });
});

describe('MemoryTrace', () => {
    const traceOf = (values: number[]) => {
        const trace = new MemoryTrace();
        const spy = jest.spyOn(process, 'memoryUsage');

        values.forEach((rss, i) => {
            spy.mockReturnValue({ rss } as NodeJS.MemoryUsage);
            trace.sample(i);
        });

        spy.mockRestore();
        return trace;
    };

    const MB = 1024 * 1024;

    it('calls a run that grows at a constant rate a leak', () => {
        const constant = Array.from({ length: 30 }, (_, i) => 100 * MB + i * 2 * MB);

        expect(traceOf(constant).verdict().leaking).toBe(true);
    });

    it('clears a run whose growth flattens out', () => {
        // Fills a working set early, then holds steady — the healthy shape.
        const flattening = Array.from({ length: 30 }, (_, i) => 100 * MB + Math.min(i, 8) * 2 * MB);

        expect(traceOf(flattening).verdict().leaking).toBe(false);
    });

    it('clears a run that never grew', () => {
        expect(traceOf(Array.from({ length: 30 }, () => 100 * MB)).verdict().leaking).toBe(false);
    });

    it('does not call too few samples a leak', () => {
        expect(traceOf([100 * MB, 200 * MB, 300 * MB]).verdict().leaking).toBe(false);
    });

    it('reports the trend even when it passes', () => {
        expect(traceOf(Array.from({ length: 30 }, () => 100 * MB)).verdict().report).toContain('RSS trace: 30 samples');
    });
});
