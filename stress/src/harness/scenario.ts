import { describe, it } from '@jest/globals';
import { Rng } from './rng';

/**
 * Scenario gating and failure attribution.
 *
 * Two rules from specs/stress-testing.md are enforced here rather than left to each
 * scenario's discipline:
 *
 *  - Nothing runs unless STRESS=1. `describe.skip` rather than an early return, so the
 *    scenario is *listed* as skipped in the default `npx jest` run. A file that silently
 *    reports zero tests is indistinguishable from one that was deleted.
 *  - Every failure prints the seed and the scale. Rather than trusting each assertion to
 *    include them, `stressIt` catches whatever escapes the body and prepends a banner.
 *    That covers thrown errors, rejected promises, and failed expectations alike.
 *
 * The banner cannot cover a Jest timeout, which is raised outside the body. Scenarios
 * therefore poll with their own deadlines (see poll.ts) and fail with an observed state
 * before Jest's timeout can fire.
 */

export const STRESS_ENABLED = process.env.STRESS === '1';

/** Scenarios needing Docker want both gates. */
export const CONTAINERS_ENABLED = STRESS_ENABLED && process.env.E2E_CONTAINERS === '1';

export const stressDescribe = STRESS_ENABLED ? describe : describe.skip;
export const containerStressDescribe = CONTAINERS_ENABLED ? describe : describe.skip;

/** The scale knobs a scenario ran at. Printed verbatim on failure. */
export type Scale = Readonly<Record<string, number | string>>;

export type ScenarioContext = {
    readonly rng: Rng;
    readonly seed: number;
    readonly scale: Scale;
    /**
     * Adds an observation to the failure banner.
     *
     * Use it for facts discovered mid-run that the reader would otherwise have to
     * reconstruct: the batch index a divergence first appeared at, the RSS trend, the
     * notification counts. On success it is discarded.
     */
    note(message: string): void;
};

const formatScale = (scale: Scale) =>
    Object.entries(scale)
        .map(([key, value]) => `${key}=${typeof value === 'number' ? value.toLocaleString('en-US') : value}`)
        .join(' ');

/**
 * Declares a stress test that always reports its seed and scale when it fails.
 *
 * `seed` is a literal in the calling file, never generated. Reproduction is
 * "run the file again", with no state to carry between runs.
 */
export function stressIt(
    name: string,
    config: {
        readonly seed: number;
        readonly scale: Scale;
        /**
         * The defect number in specs/known-defects.md that this scenario currently trips
         * on. Runs the scenario under `it.failing`, following the repository convention:
         * the test PASSES while the defect exists and FAILS the moment it is fixed, so a
         * fix cannot land silently. Never use it to quieten a failure you have not first
         * reduced and recorded.
         */
        readonly knownFailing?: number;
    },
    body: (context: ScenarioContext) => Promise<void>
) {
    const declare = config.knownFailing == null ? it : it.failing;
    const declaredName = config.knownFailing == null
        ? name
        : `${name} [pinned: known defect #${config.knownFailing}]`;

    declare(declaredName, async () => {
        const notes: string[] = [];
        const context: ScenarioContext = {
            rng: new Rng(config.seed),
            seed: config.seed,
            scale: config.scale,
            note: message => notes.push(message),
        };

        try {
            await body(context);
        } catch (error: any) {
            const banner = [
                '',
                '─'.repeat(72),
                `STRESS FAILURE: ${name}`,
                `  seed:  ${config.seed}`,
                `  scale: ${formatScale(config.scale)}`,
                ...(notes.length > 0 ? ['  notes:', ...notes.map(n => `    - ${n}`)] : []),
                '─'.repeat(72),
                '',
            ].join('\n');

            // Rethrowing the original object rather than a new Error keeps Jest's matcher
            // diff, which is usually the most informative part of the message.
            error.message = `${banner}${error.message ?? String(error)}`;
            throw error;
        }
    });
}
