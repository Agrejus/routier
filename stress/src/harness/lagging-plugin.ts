import {
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    DbPluginQueryEvent,
    IDbPlugin,
    ITranslatedValue,
} from '@routier/core/plugins';
import {
    PluginEventCallbackPartialResult,
    PluginEventCallbackResult,
} from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { Rng } from './rng';

/**
 * A plugin that answers correctly but late.
 *
 * S7 needs a source database that is slow the way a network is slow, and no real plugin in
 * this repository is. Every backend here is either in-process or on local disk, so a
 * replication layer built on them is never actually observed mid-flight: by the time the next
 * statement runs, the mirror write has already landed. That hides the entire class of defect
 * S7 hunts — a read that reaches the source before the mirror caught up, a removal that a
 * still-in-flight hydration puts back.
 *
 * So the lag is injected. This wraps any `IDbPlugin` and delays the *callback*, not the work:
 * the underlying operation runs immediately and its result is held for a scheduled interval.
 * Delaying the call instead would serialise operations that the real system runs
 * concurrently, which is the opposite of the interleaving under test.
 *
 * Two properties matter for this to be usable as evidence:
 *
 *  - **The delay is seeded.** Drawn from a `Rng`, so the interleaving that exposed a defect
 *    replays from the scenario's printed seed. `Math.random` here would make every S7 failure
 *    a rumour.
 *  - **Timers are tracked and cancellable.** A pending `setTimeout` holds the event loop open
 *    and would be indistinguishable from the leak S5 hunts. `drain()` waits for what is in
 *    flight; `cancel()` drops it. A scenario must call one of them.
 */
export type LaggingPluginOptions = {
    /** Inclusive delay bounds, in milliseconds, applied to each delayed callback. */
    readonly minMs: number;
    readonly maxMs: number;
    /** Which operations to delay. Defaults to persists only, which is what S7 asks for. */
    readonly delay?: {
        readonly bulkPersist?: boolean;
        readonly query?: boolean;
    };
};

export class LaggingPlugin implements IDbPlugin {
    private readonly pending = new Set<ReturnType<typeof setTimeout>>();
    private readonly delayQuery: boolean;
    private readonly delayBulkPersist: boolean;

    /**
     * Observed counts, so a scenario can assert the lag was actually exercised.
     *
     * `completedCallbacks` is the one that is easy to overlook and the one that matters most.
     * A delayed callback only fires when the event loop reaches the macrotask queue, and an
     * `await` chain over an in-process plugin resolves through microtasks without ever getting
     * there. A scenario that never yields therefore stalls the mirror completely — every
     * callback still pending at the end — which tests a fully stopped mirror rather than a
     * trailing one, and silently skips any defect that needs a late arrival to race a new
     * write. Comparing this against `delayedCallbacks` is how a scenario tells the two apart.
     */
    readonly stats = { queries: 0, persists: 0, delayedCallbacks: 0, completedCallbacks: 0, totalDelayMs: 0 };

    constructor(
        private readonly inner: IDbPlugin,
        private readonly rng: Rng,
        private readonly options: LaggingPluginOptions
    ) {
        if (options.minMs < 0 || options.maxMs < options.minMs) {
            throw new Error(`LaggingPlugin needs 0 <= minMs <= maxMs, got ${options.minMs}..${options.maxMs}`);
        }

        this.delayQuery = options.delay?.query ?? false;
        this.delayBulkPersist = options.delay?.bulkPersist ?? true;
    }

    /**
     * The wrapped plugin's identity, passed through unchanged.
     *
     * Subscription channels are scoped by schema plus identity. Swallowing it here would put
     * a wrapped plugin on a different channel from an unwrapped one over the same database,
     * and the scenario would be measuring the wrapper instead of the system.
     */
    get identity() {
        return this.inner.identity;
    }

    /** Callbacks still waiting on a timer. */
    get inFlight() {
        return this.pending.size;
    }

    private later(run: () => void) {
        const delayMs = this.rng.between(this.options.minMs, this.options.maxMs);

        this.stats.delayedCallbacks++;
        this.stats.totalDelayMs += delayMs;

        const timer = setTimeout(() => {
            this.pending.delete(timer);
            this.stats.completedCallbacks++;
            run();
        }, delayMs);

        this.pending.add(timer);
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.stats.queries++;

        if (this.delayQuery === false) {
            this.inner.query(event, done);
            return;
        }

        this.inner.query(event, result => this.later(() => done(result)));
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.stats.persists++;

        if (this.delayBulkPersist === false) {
            this.inner.bulkPersist(event, done);
            return;
        }

        this.inner.bulkPersist(event, result => this.later(() => done(result)));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        // Never delayed, and pending callbacks are dropped rather than awaited. Destroy is
        // teardown: a scenario that wanted the in-flight work should have called `drain`
        // first, and holding teardown behind a timer only turns a missing drain into a
        // timeout somewhere less obvious.
        this.cancel();
        this.inner.destroy(event, done);
    }

    /** Resolves once no delayed callback is outstanding. */
    async drain(deadlineMs = 30_000): Promise<void> {
        const startedAt = Date.now();

        while (this.pending.size > 0) {
            if (Date.now() - startedAt > deadlineMs) {
                throw new Error(
                    `LaggingPlugin.drain timed out after ${deadlineMs}ms with ${this.pending.size} callback(s) still pending`
                );
            }

            await new Promise<void>(resolve => setTimeout(resolve, 5));
        }
    }

    /**
     * Yields to the macrotask queue so callbacks whose delay has elapsed can fire.
     *
     * The escape hatch for the microtask problem described on `stats`. A scenario that awaits
     * only in-process operations must call this if it wants the mirror to make progress
     * *during* the run rather than all at once at the end.
     */
    yieldToTimers(): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, 0));
    }

    /** Drops every pending callback. The wrapped operations have already run. */
    cancel() {
        for (const timer of this.pending) {
            clearTimeout(timer);
        }
        this.pending.clear();
    }
}
