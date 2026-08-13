/**
 * Waiting for asynchronous effects without sleeping on a guess.
 *
 * `await wait(50)` is the reflex and it is wrong twice over: it is too short under load
 * (a false failure that looks like a race) and too long everywhere else (a 5k-iteration
 * scenario pays it 5,000 times). Worse, when it does fail the message says only that the
 * expectation was not met, never what the system actually settled on.
 *
 * `pollUntil` samples the condition until a deadline and, on expiry, reports the last
 * observed value. That distinguishes "converged to the wrong number" from "never
 * converged" — different defects with different fixes.
 */

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type PollOptions = {
    /** Total time to keep sampling before giving up. */
    readonly deadlineMs?: number;
    /** Delay between samples. */
    readonly intervalMs?: number;
    /** Names the condition in the failure message, e.g. "productsView count reaches 5000". */
    readonly describe: string;
    /** Renders an observed value for the failure message. */
    readonly render?: (value: unknown) => string;
};

export class PollTimeoutError extends Error {
    constructor(
        message: string,
        readonly lastObserved: unknown,
        readonly samples: number,
        readonly elapsedMs: number
    ) {
        super(message);
        this.name = 'PollTimeoutError';
    }
}

/**
 * Samples `read` until `predicate` holds, then resolves with the satisfying value.
 *
 * Throws `PollTimeoutError` — carrying the last observed value — when the deadline passes.
 */
export async function pollUntil<T>(
    read: () => Promise<T> | T,
    predicate: (value: T) => boolean,
    options: PollOptions
): Promise<T> {
    const deadlineMs = options.deadlineMs ?? 10_000;
    const intervalMs = options.intervalMs ?? 10;
    const render = options.render ?? ((value: unknown) => JSON.stringify(value));
    const startedAt = Date.now();

    let samples = 0;
    let last: T | undefined;

    // Structured as do/while so the condition is always sampled at least once. A zero
    // deadline should still see an already-satisfied condition rather than time out.
    do {
        last = await read();
        samples++;

        if (predicate(last)) {
            return last;
        }

        await sleep(intervalMs);
    } while (Date.now() - startedAt < deadlineMs);

    const elapsedMs = Date.now() - startedAt;

    throw new PollTimeoutError(
        `Timed out after ${elapsedMs}ms (${samples} samples) waiting for: ${options.describe}\n` +
        `  last observed: ${render(last)}`,
        last,
        samples,
        elapsedMs
    );
}

/**
 * Waits for a value to stop changing.
 *
 * Some invariants are about the end state of a cascade rather than a known target —
 * a view fed by a subscription fed by another subscription has no count you can predict
 * up front, only one it should settle on. This resolves once `read` returns the same
 * rendered value `stableSamples` times running.
 */
export async function pollUntilStable<T>(
    read: () => Promise<T> | T,
    options: PollOptions & { readonly stableSamples?: number }
): Promise<T> {
    const stableSamples = options.stableSamples ?? 5;
    const render = options.render ?? ((value: unknown) => JSON.stringify(value));

    let previous: string | undefined;
    let runLength = 0;

    return pollUntil(
        read,
        value => {
            const rendered = render(value);

            if (rendered === previous) {
                runLength++;
            } else {
                previous = rendered;
                runLength = 1;
            }

            return runLength >= stableSamples;
        },
        { ...options, describe: `${options.describe} (stable for ${stableSamples} samples)` }
    );
}

export { sleep };
