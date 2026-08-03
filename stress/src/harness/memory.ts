/**
 * Detecting unbounded growth from RSS samples.
 *
 * An absolute ceiling is the obvious check and the wrong one: RSS depends on the GC's
 * mood, on what else the Jest worker has loaded, and on the platform. A run that leaks
 * badly can finish under any threshold generous enough not to fail spuriously.
 *
 * What a leak actually looks like is a *rate* that does not decay. A healthy run grows
 * while caches and the entity set fill, then flattens once the working set is steady;
 * a leaking run keeps climbing at the same slope from first sample to last. So the check
 * compares the growth rate of the final third against the first third, per
 * specs/stress-testing.md S3.
 */

export type MemorySample = {
    /** Iteration, batch, or cycle index the sample was taken at. */
    readonly at: number;
    readonly rssBytes: number;
};

export type GrowthVerdict = {
    readonly leaking: boolean;
    readonly firstThirdBytesPerUnit: number;
    readonly lastThirdBytesPerUnit: number;
    /** lastThird / firstThird. Below 1 means growth is decaying, which is the healthy shape. */
    readonly decayRatio: number;
    readonly totalGrowthBytes: number;
    readonly samples: number;
    readonly report: string;
};

export class MemoryTrace {
    private readonly samples: MemorySample[] = [];

    sample(at: number) {
        this.samples.push({ at, rssBytes: process.memoryUsage().rss });
    }

    get count() {
        return this.samples.length;
    }

    /**
     * Slope in bytes per unit of `at`, by least squares.
     *
     * A first-to-last difference would be at the mercy of whether a GC happened to run
     * just before either endpoint. Regressing over every sample in the window absorbs
     * that.
     */
    private static slope(samples: readonly MemorySample[]): number {
        if (samples.length < 2) {
            return 0;
        }

        const n = samples.length;
        const meanAt = samples.reduce((sum, s) => sum + s.at, 0) / n;
        const meanRss = samples.reduce((sum, s) => sum + s.rssBytes, 0) / n;

        let covariance = 0;
        let variance = 0;

        for (const sample of samples) {
            const dx = sample.at - meanAt;
            covariance += dx * (sample.rssBytes - meanRss);
            variance += dx * dx;
        }

        return variance === 0 ? 0 : covariance / variance;
    }

    /**
     * @param tolerance How much of the early growth rate the late rate may retain before
     *   the run counts as leaking. 1.0 means "the last third must grow strictly slower
     *   than the first third", which is too tight for a sampled RSS; the default leaves
     *   room for GC timing while still catching a rate that never decays.
     */
    verdict(tolerance = 0.85): GrowthVerdict {
        const n = this.samples.length;
        const third = Math.floor(n / 3);

        const first = this.samples.slice(0, third);
        const last = this.samples.slice(n - third);

        const firstThird = MemoryTrace.slope(first);
        const lastThird = MemoryTrace.slope(last);
        const totalGrowthBytes = n === 0 ? 0 : this.samples[n - 1].rssBytes - this.samples[0].rssBytes;

        // Too few samples to say anything, or a run that did not grow at all. Either way
        // there is no rate to compare and calling it a leak would be noise.
        const undecidable = third < 2 || firstThird <= 0;
        const decayRatio = firstThird <= 0 ? 0 : lastThird / firstThird;

        const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
        const perUnit = (bytes: number) => `${(bytes / 1024).toFixed(2)}KB/unit`;

        const report = [
            `RSS trace: ${n} samples, ${mb(this.samples[0]?.rssBytes ?? 0)} -> ${mb(this.samples[n - 1]?.rssBytes ?? 0)} (${totalGrowthBytes >= 0 ? '+' : ''}${mb(totalGrowthBytes)})`,
            `  first third: ${perUnit(firstThird)}`,
            `  last third:  ${perUnit(lastThird)}`,
            `  decay ratio: ${decayRatio.toFixed(2)} (tolerance ${tolerance}; ${undecidable ? 'undecidable — no early growth to compare' : decayRatio > tolerance ? 'LEAKING' : 'ok'})`,
        ].join('\n');

        return {
            leaking: undecidable === false && decayRatio > tolerance,
            firstThirdBytesPerUnit: firstThird,
            lastThirdBytesPerUnit: lastThird,
            decayRatio,
            totalGrowthBytes,
            samples: n,
            report,
        };
    }
}
