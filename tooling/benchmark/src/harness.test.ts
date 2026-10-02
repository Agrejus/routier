import { describe, expect, it } from '@jest/globals';
import { compare, measure, type Measurement } from './harness';

/**
 * The regression gate is only worth having if it actually fires, so the comparison logic is
 * tested directly. Running the benchmarks themselves proves nothing about whether a
 * slowdown would be caught — a gate that silently passes everything looks identical to a
 * codebase with no regressions.
 */

const measurement = (name: string, medianMs: number): Measurement => ({
    name,
    medianMs,
    meanMs: medianMs,
    minMs: medianMs,
    maxMs: medianMs,
    samples: 30,
});

const TOLERANCE = 0.15;

describe('regression comparison', () => {
    it('passes a scenario matching its baseline', () => {
        const [result] = compare([measurement('scan', 10)], { scan: 10 }, TOLERANCE);

        expect(result.regressed).toBe(false);
        expect(result.changeRatio).toBe(0);
    });

    it('passes a scenario that got faster', () => {
        const [result] = compare([measurement('scan', 5)], { scan: 10 }, TOLERANCE);

        expect(result.regressed).toBe(false);
        expect(result.changeRatio).toBeCloseTo(-0.5);
    });

    it('passes a slowdown within tolerance', () => {
        // 10% slower against a 15% tolerance: noise, not a regression.
        const [result] = compare([measurement('scan', 11)], { scan: 10 }, TOLERANCE);

        expect(result.regressed).toBe(false);
    });

    it('fails a slowdown beyond tolerance', () => {
        const [result] = compare([measurement('scan', 12)], { scan: 10 }, TOLERANCE);

        expect(result.regressed).toBe(true);
        expect(result.changeRatio).toBeCloseTo(0.2);
    });

    it('treats exactly the tolerance as acceptable', () => {
        // The boundary is inclusive: 15.0% slower does not fail a 15% gate. Pinned because
        // an off-by-one here makes the gate fire on the noise it was sized to absorb.
        const [result] = compare([measurement('scan', 11.5)], { scan: 10 }, TOLERANCE);

        expect(result.regressed).toBe(false);
    });

    it('does not fail a scenario that has no baseline yet', () => {
        const [result] = compare([measurement('brand-new', 999)], {}, TOLERANCE);

        // Otherwise adding a benchmark would fail the very change that adds it.
        expect(result.regressed).toBe(false);
        expect(result.baselineMs).toBeNull();
        expect(result.changeRatio).toBeNull();
    });

    it('does not divide by a zero baseline', () => {
        const [result] = compare([measurement('scan', 5)], { scan: 0 }, TOLERANCE);

        expect(result.regressed).toBe(false);
        expect(result.changeRatio).toBeNull();
    });

    it('reports each scenario independently', () => {
        const results = compare(
            [measurement('fast', 10), measurement('slow', 20)],
            { fast: 10, slow: 10 },
            TOLERANCE,
        );

        expect(results.map(r => r.regressed)).toEqual([false, true]);
    });
});

describe('measurement', () => {
    it('reports the median rather than the mean', async () => {
        let call = 0;
        // One pathological sample among many: a mean would be dragged upward by it, a median
        // would not. This is why the gate compares medians.
        const result = await measure({
            name: 'spiky',
            run: () => {
                call++;
                const until = performance.now() + (call === 4 ? 20 : 0);
                while (performance.now() < until) { /* burn */ }
            },
        }, { warmup: 0, samples: 9 });

        expect(result.maxMs).toBeGreaterThan(10);
        expect(result.medianMs).toBeLessThan(5);
        expect(result.meanMs).toBeGreaterThan(result.medianMs);
    });

    it('takes the requested number of samples', async () => {
        const result = await measure({ name: 'noop', run: () => undefined }, { warmup: 1, samples: 7 });

        expect(result.samples).toBe(7);
    });

    it('rebuilds the fixture per sample by default', async () => {
        let setups = 0;
        await measure({ name: 'mutating', setup: () => { setups++; }, run: () => undefined }, { warmup: 2, samples: 5 });

        // A write benchmark must not accumulate state across samples.
        expect(setups).toBe(7);
    });

    it('builds the fixture once when reuseSetup is set', async () => {
        let setups = 0;
        await measure(
            { name: 'read-only', reuseSetup: true, setup: () => { setups++; }, run: () => undefined },
            { warmup: 2, samples: 5 },
        );

        expect(setups).toBe(1);
    });

    it('keeps setup out of the timed region', async () => {
        const result = await measure({
            name: 'slow-setup',
            setup: () => {
                const until = performance.now() + 5;
                while (performance.now() < until) { /* burn */ }
            },
            run: () => undefined,
        }, { warmup: 0, samples: 3 });

        // Setup costs ~5ms per sample; the measurement must not include it.
        expect(result.medianMs).toBeLessThan(2);
    });
});
