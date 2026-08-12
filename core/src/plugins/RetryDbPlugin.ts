import { BulkPersistResult } from "../collections";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * Retries a failed READ, and never a write.
 *
 * ## Why reads only
 *
 * A read is idempotent by construction: running the same query twice asks the same question
 * and changes nothing, so a second attempt is free apart from latency. That is what makes a
 * blanket retry safe here, and it is why this wrapper does not need to know which errors are
 * transient — see `shouldRetry`.
 *
 * A save is not. `bulkPersist` is a batch of adds, updates and removes, and a failure gives no
 * general way to know how much of it landed: a backend without atomic batches may have applied
 * part of it, and a retry then re-applies what already succeeded. Adds are the sharpest case —
 * an identity is assigned by the database, so a repeated INSERT does not collide, it
 * DUPLICATES. Rows appear that no caller asked for, no error is reported, and the change
 * tracker records a successful save.
 *
 * Retrying a write safely would need the write to carry an idempotency key the backend
 * deduplicates on, which is a property of a backend rather than something a wrapper can add.
 * So this refuses to guess, and a failed save is surfaced for the caller to decide about.
 *
 * ```ts
 * const store = new MyStore(new RetryDbPlugin(new SomeDbPlugin(...), { attempts: 3 }));
 * ```
 */

export type RetryDbPluginOptions = {
    /**
     * Total attempts, including the first. Default 3, minimum 1.
     *
     * "Attempts" rather than "retries" because off-by-one here is a real cost — the difference
     * between three calls and four against a struggling backend.
     */
    attempts?: number;
    /**
     * Milliseconds to wait before attempt `attempt` (2 for the first retry).
     *
     * Default is exponential — 50ms, 100ms, 200ms — with no jitter. Jitter matters when many
     * clients retry in lockstep after a shared outage, and a caller with that problem knows it
     * and can supply a delay; adding randomness by default would make tests non-deterministic
     * for everyone else.
     */
    delayMs?: (attempt: number) => number;
    /**
     * Whether an error is worth another attempt. Default: every error is.
     *
     * That default is deliberate and only defensible because this retries reads alone. A
     * wrapper cannot know which of a backend's errors are transient without naming that
     * backend, and guessing wrong in the cautious direction means not retrying the failure the
     * caller installed this for. Retrying a permanent error instead costs a bounded amount of
     * latency and nothing else.
     *
     * Supply this to narrow it — a syntax error in a filter will never succeed on a second try.
     */
    shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const DEFAULT_ATTEMPTS = 3;
const defaultDelay = (attempt: number) => 50 * Math.pow(2, attempt - 2);

export class RetryDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly attempts: number;
    private readonly delayMs: (attempt: number) => number;
    private readonly shouldRetry: (error: unknown, attempt: number) => boolean;

    constructor(plugin: IDbPlugin, options: RetryDbPluginOptions = {}) {
        this.plugin = plugin;
        // Floored at 1: zero attempts would never call the inner plugin and would report a
        // failure that never happened.
        this.attempts = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
        this.delayMs = options.delayMs ?? defaultDelay;
        this.shouldRetry = options.shouldRetry ?? (() => true);
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.attempt(event, done, 1);
    }

    /**
     * One attempt, scheduling the next on failure.
     *
     * Recursive rather than a loop because the inner plugin is callback-based: there is no
     * promise to await, and wrapping each attempt in one would change when errors surface.
     */
    private attempt<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>,
        attempt: number
    ): void {
        this.plugin.query<TRoot, TShape>(event, result => {

            if (result.ok !== PluginEventResult.ERROR) {
                done(result);
                return;
            }

            const isLastAttempt = attempt >= this.attempts;

            if (isLastAttempt || this.shouldRetry(result.error, attempt) === false) {
                // The error from the LAST attempt, not the first. It is the most recent state
                // of the world, and a caller comparing two failures wants the newer one.
                done(result);
                return;
            }

            const delay = this.delayMs(attempt + 1);

            if (delay <= 0) {
                this.attempt(event, done, attempt + 1);
                return;
            }

            setTimeout(() => this.attempt(event, done, attempt + 1), delay);
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        // Straight through. See the note on this class: a partly-applied save cannot be
        // repeated safely, and a duplicated add is worse than a surfaced error.
        this.plugin.bulkPersist(event, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        // Not retried either. Destroy is usually irreversible, and a second attempt against a
        // database the first one already removed reports a failure for work that succeeded.
        this.plugin.destroy(event, done);
    }
}
