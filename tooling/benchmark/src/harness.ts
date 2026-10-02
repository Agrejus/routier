/**
 * Measurement harness for the performance regression gates.
 *
 * The design follows what the perf work established: warm up before measuring, take many
 * samples, and compare medians rather than means. A single timing is dominated by JIT state
 * and whatever else the machine is doing — the flaky `expect(duration).toBeLessThan(0.5)`
 * assertion removed from parser.test.ts in Phase 0 failed at 0.535ms for exactly that
 * reason. Medians over repeated samples are stable enough to gate on.
 */

export type Scenario = {
    readonly name: string;
    /**
     * Builds the fixture the measured operation runs against.
     *
     * Re-run per sample by default, because a write benchmark must not measure an
     * ever-growing table. Read-only scenarios should set `reuseSetup` — seeding 10,000 rows
     * 33 times per scenario costs far more than the reads being measured.
     */
    readonly setup?: () => Promise<unknown> | unknown;
    /**
     * Build the fixture once and share it across warmups and samples.
     *
     * Only valid when `run` does not mutate the fixture; otherwise samples are not
     * comparable to each other.
     */
    readonly reuseSetup?: boolean;
    /** The measured operation. Called once per warmup and once per sample. */
    readonly run: (context: any) => Promise<unknown> | unknown;
};

export type Measurement = {
    readonly name: string;
    readonly medianMs: number;
    readonly meanMs: number;
    readonly minMs: number;
    readonly maxMs: number;
    readonly samples: number;
};

export type HarnessOptions = {
    /** Untimed iterations before sampling, to let the JIT settle. */
    readonly warmup?: number;
    /** Timed iterations. The spec calls for 30. */
    readonly samples?: number;
};

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;

    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

export async function measure(scenario: Scenario, options: HarnessOptions = {}): Promise<Measurement> {
    const warmup = options.warmup ?? 5;
    const samples = options.samples ?? 30;

    // Setup runs outside every timed region. For read-only scenarios it is hoisted out of
    // the loop entirely; for mutating ones it is repeated per sample so each sample measures
    // the operation against equivalent state rather than the previous sample's leftovers.
    const sharedContext = scenario.reuseSetup === true ? await scenario.setup?.() : undefined;
    const contextFor = async () => (scenario.reuseSetup === true ? sharedContext : await scenario.setup?.());

    for (let i = 0; i < warmup; i++) {
        await scenario.run(await contextFor());
    }

    const durations: number[] = [];

    for (let i = 0; i < samples; i++) {
        const context = await contextFor();

        const start = performance.now();
        await scenario.run(context);
        durations.push(performance.now() - start);
    }

    return {
        name: scenario.name,
        medianMs: median(durations),
        meanMs: durations.reduce((total, d) => total + d, 0) / durations.length,
        minMs: Math.min(...durations),
        maxMs: Math.max(...durations),
        samples: durations.length,
    };
}

export type Comparison = {
    readonly name: string;
    readonly medianMs: number;
    readonly baselineMs: number | null;
    /** Positive means slower than baseline. */
    readonly changeRatio: number | null;
    readonly regressed: boolean;
};

/**
 * Compares measurements against stored baselines.
 *
 * @param toleranceRatio Fractional slowdown allowed before a scenario counts as regressed.
 */
export function compare(
    measurements: Measurement[],
    baselines: Record<string, number>,
    toleranceRatio: number
): Comparison[] {
    return measurements.map(m => {
        const baselineMs = baselines[m.name] ?? null;

        if (baselineMs == null || baselineMs === 0) {
            // A scenario with no baseline is reported but cannot regress: failing a run for
            // a newly added scenario would block the change that introduces it.
            return { name: m.name, medianMs: m.medianMs, baselineMs, changeRatio: null, regressed: false };
        }

        const changeRatio = (m.medianMs - baselineMs) / baselineMs;

        return {
            name: m.name,
            medianMs: m.medianMs,
            baselineMs,
            changeRatio,
            regressed: changeRatio > toleranceRatio,
        };
    });
}

export function formatTable(comparisons: Comparison[]): string {
    const rows = comparisons.map(c => {
        const change = c.changeRatio == null
            ? 'new'
            : `${c.changeRatio >= 0 ? '+' : ''}${(c.changeRatio * 100).toFixed(1)}%`;
        const baseline = c.baselineMs == null ? '—' : c.baselineMs.toFixed(3);

        return `${c.regressed ? 'REGRESSED' : 'ok       '}  ${c.name.padEnd(28)} ${c.medianMs.toFixed(3).padStart(10)}ms  baseline ${baseline.padStart(10)}ms  ${change}`;
    });

    return rows.join('\n');
}
