import { describe, expect, it } from '@jest/globals';
import { LaggingPlugin } from './lagging-plugin';
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
    /**
     * Drives the trace with a scripted retained-heap series.
     *
     * The collector is injected as "succeeded" because these tests are about the arithmetic,
     * not about whether `--expose-gc` was passed — that refusal has its own test below. It is
     * injected rather than stubbed on `globalThis` because `--expose-gc` defines `gc` as
     * non-configurable, so under the flag the suite actually runs with, deleting or assigning
     * it throws.
     */
    const traceOf = (values: number[]) => {
        const trace = new MemoryTrace(() => true);
        const usage = jest.spyOn(process, 'memoryUsage');

        values.forEach((heapUsed, i) => {
            usage.mockReturnValue({ heapUsed, rss: heapUsed } as NodeJS.MemoryUsage);
            trace.sample(i);
        });

        usage.mockRestore();

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

    it('calls a flat run flat rather than undecidable', () => {
        // The bug this replaced: a run whose retained heap barely moves is the HEALTHY shape,
        // and the old code reported it as "no early growth to compare" and passed by
        // abstaining — indistinguishable from having measured nothing.
        const flat = Array.from({ length: 30 }, (_, i) => 100 * MB + (i % 2 === 0 ? 0 : 64 * 1024));
        const verdict = traceOf(flat).verdict();

        expect(verdict.leaking).toBe(false);
        expect(verdict.report).toContain('retained heap is flat');
    });

    it('calls a run that only starts growing late a leak', () => {
        // Flat, then climbing. There is no early rate to decay from, and the old ratio test
        // divided by a non-positive first third and gave up.
        const lateGrowth = Array.from({ length: 30 }, (_, i) => 100 * MB + Math.max(0, i - 15) * 4 * MB);

        expect(traceOf(lateGrowth).verdict().leaking).toBe(true);
    });

    it('does not call too few samples a leak', () => {
        expect(traceOf([100 * MB, 200 * MB, 300 * MB]).verdict().leaking).toBe(false);
    });

    it('reports the trend even when it passes', () => {
        expect(traceOf(Array.from({ length: 30 }, () => 100 * MB)).verdict().report)
            .toContain('Retained heap (post-GC): 30 samples');
    });

    it('refuses to conclude anything when no collection can be forced', () => {
        // Without --expose-gc the samples describe GC scheduling, not retention. Reporting
        // `measurable: false` is what stops the caller asserting on noise.
        const trace = new MemoryTrace(() => false);
        const usage = jest.spyOn(process, 'memoryUsage');

        for (let i = 0; i < 30; i++) {
            usage.mockReturnValue({ heapUsed: 100 * MB + i * 4 * MB, rss: 0 } as NodeJS.MemoryUsage);
            trace.sample(i);
        }

        usage.mockRestore();

        const verdict = trace.verdict();

        // The series is a textbook leak, and it still must not be called one.
        expect(verdict.measurable).toBe(false);
        expect(verdict.leaking).toBe(false);
        expect(verdict.report).toContain('NOT MEASURED');
    });
});

describe('LaggingPlugin', () => {
    /**
     * A stand-in for a real plugin. The events are not inspected — what is under test is the
     * wrapper's timing and bookkeeping, not any plugin's behaviour — so the fake records what
     * it was asked to do and hands back a recognisable result.
     */
    const fake = () => {
        const calls: string[] = [];

        return {
            calls,
            databaseName: 'fake-database',
            query: (_event: any, done: any) => { calls.push('query'); done('query-result'); },
            bulkPersist: (_event: any, done: any) => { calls.push('persist'); done('persist-result'); },
            destroy: (_event: any, done: any) => { calls.push('destroy'); done('destroy-result'); },
        };
    };

    const wrap = (inner: any, options?: Partial<ConstructorParameters<typeof LaggingPlugin>[2]>) =>
        new LaggingPlugin(inner as any, new Rng(4242), { minMs: 10, maxMs: 20, ...options });

    it('passes the wrapped plugin database name through', () => {
        // Channels are scoped by schema plus database name. A wrapper that dropped it would
        // put a lagged plugin on a different subscription channel from an unlagged one over
        // the same database.
        expect(wrap(fake()).databaseName).toBe('fake-database');
    });

    it('runs the wrapped operation immediately and delays only the callback', () => {
        const inner = fake();
        const plugin = wrap(inner);
        let answered = false;

        plugin.bulkPersist({} as any, (() => { answered = true; }) as any);

        // The work has happened; only the answer is outstanding. Delaying the call instead
        // would serialise operations the real system runs concurrently.
        expect(inner.calls).toEqual(['persist']);
        expect(answered).toBe(false);
        expect(plugin.inFlight).toBe(1);

        plugin.cancel();
    });

    it('eventually delivers the wrapped result unchanged', async () => {
        const plugin = wrap(fake());

        const result = await new Promise(resolve => plugin.bulkPersist({} as any, resolve as any));

        expect(result).toBe('persist-result');
        expect(plugin.inFlight).toBe(0);
    });

    it('leaves queries undelayed by default', () => {
        const plugin = wrap(fake());
        let answered = false;

        plugin.query({} as any, (() => { answered = true; }) as any);

        expect(answered).toBe(true);
        expect(plugin.inFlight).toBe(0);
    });

    it('delays queries when asked to', () => {
        const plugin = wrap(fake(), { delay: { query: true } });
        let answered = false;

        plugin.query({} as any, (() => { answered = true; }) as any);

        expect(answered).toBe(false);
        expect(plugin.inFlight).toBe(1);

        plugin.cancel();
    });

    it('draws delays from the seed, so a run replays', () => {
        const delaysFor = () => {
            const plugin = new LaggingPlugin(fake() as any, new Rng(1234), { minMs: 5, maxMs: 50 });

            for (let i = 0; i < 5; i++) {
                plugin.bulkPersist({} as any, (() => undefined) as any);
            }

            const total = plugin.stats.totalDelayMs;
            plugin.cancel();
            return total;
        };

        expect(delaysFor()).toBe(delaysFor());
    });

    it('keeps every delay inside the configured bounds', () => {
        const plugin = new LaggingPlugin(fake() as any, new Rng(7), { minMs: 10, maxMs: 12 });

        for (let i = 0; i < 100; i++) {
            plugin.bulkPersist({} as any, (() => undefined) as any);
        }

        // Only the aggregate is observable, which is enough: 100 draws averaging inside
        // [10, 12] cannot contain a draw outside it without another compensating for it, and
        // the generator has no negative range to compensate with.
        expect(plugin.stats.totalDelayMs).toBeGreaterThanOrEqual(1000);
        expect(plugin.stats.totalDelayMs).toBeLessThanOrEqual(1200);

        plugin.cancel();
    });

    it('rejects bounds it cannot draw from', () => {
        expect(() => new LaggingPlugin(fake() as any, new Rng(1), { minMs: 50, maxMs: 10 })).toThrow();
        expect(() => new LaggingPlugin(fake() as any, new Rng(1), { minMs: -1, maxMs: 10 })).toThrow();
    });

    it('drain resolves only once nothing is outstanding', async () => {
        const plugin = wrap(fake());
        const answered: number[] = [];

        for (let i = 0; i < 5; i++) {
            plugin.bulkPersist({} as any, (() => answered.push(i)) as any);
        }

        expect(plugin.inFlight).toBe(5);

        await plugin.drain();

        expect(plugin.inFlight).toBe(0);
        expect(answered).toHaveLength(5);
    });

    it('drain fails loudly rather than hanging', async () => {
        const plugin = new LaggingPlugin(fake() as any, new Rng(1), { minMs: 5_000, maxMs: 5_000 });
        plugin.bulkPersist({} as any, (() => undefined) as any);

        await expect(plugin.drain(50)).rejects.toThrow('still pending');

        plugin.cancel();
    });

    it('counts callbacks that actually landed, separately from those merely scheduled', async () => {
        // The distinction a scenario needs to tell a stalled mirror from a trailing one. A
        // pending callback is scheduled but has changed nothing yet.
        const plugin = wrap(fake());

        plugin.bulkPersist({} as any, (() => undefined) as any);

        expect(plugin.stats.delayedCallbacks).toBe(1);
        expect(plugin.stats.completedCallbacks).toBe(0);

        await plugin.drain();

        expect(plugin.stats.completedCallbacks).toBe(1);
    });

    it('yieldToTimers lets an elapsed callback fire', async () => {
        const plugin = new LaggingPlugin(fake() as any, new Rng(3), { minMs: 0, maxMs: 0 });
        let answered = false;

        plugin.bulkPersist({} as any, (() => { answered = true; }) as any);

        // Awaiting a resolved promise is not enough — that stays in the microtask queue, which
        // is the whole reason this method exists.
        await Promise.resolve();
        expect(answered).toBe(false);

        await plugin.yieldToTimers();
        expect(answered).toBe(true);
    });

    it('cancel drops pending callbacks so no timer outlives the test', () => {
        const plugin = wrap(fake());
        let answered = false;

        plugin.bulkPersist({} as any, (() => { answered = true; }) as any);
        plugin.cancel();

        expect(plugin.inFlight).toBe(0);
        expect(answered).toBe(false);
    });

    it('destroy cancels pending callbacks and reaches the wrapped plugin', async () => {
        const inner = fake();
        const plugin = wrap(inner);

        plugin.bulkPersist({} as any, (() => undefined) as any);

        const result = await new Promise(resolve => plugin.destroy({} as any, resolve as any));

        expect(result).toBe('destroy-result');
        expect(plugin.inFlight).toBe(0);
        expect(inner.calls).toContain('destroy');
    });
});
