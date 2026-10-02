/**
 * Detecting unbounded growth from memory samples.
 *
 * An absolute ceiling is the obvious check and the wrong one: memory depends on the GC's
 * mood, on what else the Jest worker has loaded, and on the platform. A run that leaks badly
 * can finish under any threshold generous enough not to fail spuriously.
 *
 * What a leak actually looks like is memory that is still RETAINED after a collection. That
 * distinction is the whole design of this file, and it was learned the hard way.
 *
 * ## Why this samples a forced collection rather than RSS
 *
 * The first version sampled `process.memoryUsage().rss` with no collection, and compared the
 * growth rate of the last third against the first. It measured *when V8 chose to collect*,
 * not what the program held, and it was wrong in both directions:
 *
 * - On CI it reported LEAKING on every run — RSS climbed 233MB to 491MB with a decay ratio of
 *   0.95 to 1.00, because a runner with headroom defers collection and RSS rises linearly.
 * - Locally it PASSED, but vacuously: a collection happened to land early, the first-third
 *   slope went negative, and the `firstThird <= 0` guard returned "undecidable". The green
 *   tick meant "could not measure", while the last third was climbing at 65KB/cycle.
 *
 * Forcing a collection and reading `heapUsed` answers the question actually being asked. On
 * the same workload that reported +206MB of RSS growth, retained heap moved 294.0MB → 294.5MB
 * across 10,000 cycles: flat, which is the truth.
 *
 * ## When it cannot measure, it says so
 *
 * Forcing a collection needs `--expose-gc`. Without it the old numbers come back and so does
 * the coin flip, so `verdict()` reports `measurable: false` and callers skip the assertion
 * rather than emit a verdict from noise. The stress job passes `NODE_OPTIONS=--expose-gc`.
 */

/** Present only under `--expose-gc`. */
const forceCollection = (): boolean => {
    const globalWithGc = globalThis as unknown as { gc?: () => void };

    if (typeof globalWithGc.gc !== 'function') {
        return false;
    }

    // Twice: the first pass can leave objects that only became unreachable during it.
    globalWithGc.gc();
    globalWithGc.gc();

    return true;
};

export type MemorySample = {
    /** Iteration, batch, or cycle index the sample was taken at. */
    readonly at: number;
    /** Retained heap after a forced collection, or the raw figure when none could be forced. */
    readonly heapBytes: number;
    /** Resident set at the same moment. Reported for context; never asserted on. */
    readonly rssBytes: number;
};

export type GrowthVerdict = {
    readonly leaking: boolean;
    /** False when no collection could be forced, so nothing here is evidence. */
    readonly measurable: boolean;
    readonly firstThirdBytesPerUnit: number;
    readonly lastThirdBytesPerUnit: number;
    /** lastThird / firstThird. Below 1 means growth is decaying, which is the healthy shape. */
    readonly decayRatio: number;
    readonly totalGrowthBytes: number;
    readonly samples: number;
    readonly report: string;
};

/**
 * Retained growth under this fraction of the starting heap is flat, and flat is the answer —
 * not "undecidable". A steady working set is exactly what a healthy churn run looks like, and
 * the old code could not distinguish it from having no signal.
 */
const FLAT_GROWTH_FRACTION = 0.05;

export class MemoryTrace {
    private readonly samples: MemorySample[] = [];
    private collectionForced = true;

    /**
     * @param collect Forces a collection and reports whether it could. Injectable so the
     *   verdict arithmetic — and the refusal to conclude anything without a collection — can
     *   be tested without touching `globalThis.gc`, which `--expose-gc` defines as
     *   non-configurable and therefore neither deletable nor assignable.
     */
    constructor(private readonly collect: () => boolean = forceCollection) { }

    sample(at: number) {
        // Recorded per sample: a run where the flag is missing must not be reported as if it
        // had measured retention.
        this.collectionForced = this.collect() && this.collectionForced;

        const usage = process.memoryUsage();

        this.samples.push({ at, heapBytes: usage.heapUsed, rssBytes: usage.rss });
    }

    get count() {
        return this.samples.length;
    }

    /**
     * Slope in bytes per unit of `at`, by least squares.
     *
     * A first-to-last difference would be at the mercy of whether a collection happened to
     * run just before either endpoint. Regressing over every sample in the window absorbs
     * that.
     */
    private static slope(samples: readonly MemorySample[]): number {
        if (samples.length < 2) {
            return 0;
        }

        const n = samples.length;
        const meanAt = samples.reduce((sum, s) => sum + s.at, 0) / n;
        const meanHeap = samples.reduce((sum, s) => sum + s.heapBytes, 0) / n;

        let covariance = 0;
        let variance = 0;

        for (const sample of samples) {
            const dx = sample.at - meanAt;
            covariance += dx * (sample.heapBytes - meanHeap);
            variance += dx * dx;
        }

        return variance === 0 ? 0 : covariance / variance;
    }

    /**
     * @param tolerance How much of the early growth rate the late rate may retain before the
     *   run counts as leaking. Only consulted when the run actually grew — see
     *   {@link FLAT_GROWTH_FRACTION}.
     */
    verdict(tolerance = 0.85): GrowthVerdict {
        const n = this.samples.length;
        const third = Math.floor(n / 3);

        const firstThird = MemoryTrace.slope(this.samples.slice(0, third));
        const lastThird = MemoryTrace.slope(this.samples.slice(n - third));

        const startHeap = this.samples[0]?.heapBytes ?? 0;
        const endHeap = this.samples[n - 1]?.heapBytes ?? 0;
        const totalGrowthBytes = n === 0 ? 0 : endHeap - startHeap;

        const decayRatio = firstThird <= 0 ? 0 : lastThird / firstThird;

        const tooFewSamples = third < 2;
        // Retained heap that barely moved is a steady working set: healthy, and decisively so.
        const flat = startHeap > 0 && totalGrowthBytes <= startHeap * FLAT_GROWTH_FRACTION;

        const leaking =
            this.collectionForced
            && tooFewSamples === false
            && flat === false
            && (firstThird <= 0
                // Grew overall with no early rate to compare against — the late rate is the
                // only evidence, and a positive one over a run that grew is a leak.
                ? lastThird > 0
                : decayRatio > tolerance);

        const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
        const perUnit = (bytes: number) => `${(bytes / 1024).toFixed(2)}KB/unit`;

        const conclusion = this.collectionForced === false
            ? 'NOT MEASURED — run with --expose-gc so retention can be separated from GC timing'
            : tooFewSamples
                ? 'too few samples'
                : flat
                    ? 'ok — retained heap is flat'
                    : leaking
                        ? 'LEAKING'
                        : 'ok — growth decays';

        const report = [
            `Retained heap (post-GC): ${n} samples, ${mb(startHeap)} -> ${mb(endHeap)} (${totalGrowthBytes >= 0 ? '+' : ''}${mb(totalGrowthBytes)})`,
            `  RSS at the same points: ${mb(this.samples[0]?.rssBytes ?? 0)} -> ${mb(this.samples[n - 1]?.rssBytes ?? 0)}`,
            `  first third: ${perUnit(firstThird)}`,
            `  last third:  ${perUnit(lastThird)}`,
            `  verdict: ${conclusion}${flat ? '' : ` (decay ratio ${decayRatio.toFixed(2)}, tolerance ${tolerance})`}`,
        ].join('\n');

        return {
            leaking,
            measurable: this.collectionForced,
            firstThirdBytesPerUnit: firstThird,
            lastThirdBytesPerUnit: lastThird,
            decayRatio,
            totalGrowthBytes,
            samples: n,
            report,
        };
    }
}
