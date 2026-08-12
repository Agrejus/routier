import { BulkPersistResult } from "../collections";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { RetryDbPlugin } from "./RetryDbPlugin";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * The retry wrapper, against a plugin that fails on demand.
 *
 * The behaviour worth pinning is not that a retry happens — it is WHERE it does not. A wrapper
 * that helpfully retried a save would duplicate rows on a backend without atomic batches, and
 * nothing in the result would say so.
 */

/** Counts calls and fails the first `failures` of them. */
class FlakyPlugin implements IDbPlugin {

    readonly databaseName = "test-db";

    queries = 0;
    persists = 0;
    destroys = 0;

    constructor(private readonly failures: { query?: number, persist?: number } = {}) { }

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.queries++;

        if (this.queries <= (this.failures.query ?? 0)) {
            done(PluginEventResult.error(event.id, new Error(`query failure ${this.queries}`)));
            return;
        }

        done(PluginEventResult.success(event.id, {
            value: [`attempt-${this.queries}`],
            isTransformed: false,
            isEmpty: false,
            forEach: (): void => undefined,
        } as unknown as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.persists++;

        if (this.persists <= (this.failures.persist ?? 0)) {
            done(PluginEventResult.error(event.id, new Error(`persist failure ${this.persists}`)));
            return;
        }

        done(PluginEventResult.success(event.id, new BulkPersistResult()));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroys++;
        done(PluginEventResult.error(event.id, new Error("destroy failure")));
    }
}

const queryEvent = { id: "q1", operation: {}, schemas: {}, source: "test", action: "query" } as unknown as DbPluginQueryEvent<{}, {}>;
const persistEvent = { id: "p1", operation: {}, schemas: {}, source: "test", action: "persist" } as unknown as DbPluginBulkPersistEvent;
const destroyEvent = { id: "d1", schemas: {}, source: "test", action: "destroy" } as unknown as DbPluginEvent;

/** No delay, so the tests do not spend real time asleep. */
const immediately = { delayMs: () => 0 };

const runQuery = (plugin: RetryDbPlugin) =>
    new Promise<any>(resolve => plugin.query(queryEvent, resolve as never));

const runPersist = (plugin: RetryDbPlugin) =>
    new Promise<any>(resolve => plugin.bulkPersist(persistEvent, resolve as never));

describe("RetryDbPlugin", () => {

    it("returns a first-attempt success without retrying", async () => {
        const inner = new FlakyPlugin();
        const result = await runQuery(new RetryDbPlugin(inner, immediately));

        expect(result.ok).not.toBe(PluginEventResult.ERROR);
        expect(inner.queries).toBe(1);
    });

    it("retries a failed read until it succeeds", async () => {
        const inner = new FlakyPlugin({ query: 2 });
        const result = await runQuery(new RetryDbPlugin(inner, { ...immediately, attempts: 3 }));

        expect(result.ok).not.toBe(PluginEventResult.ERROR);
        expect(inner.queries).toBe(3);
    });

    it("gives up after the configured number of attempts", async () => {
        const inner = new FlakyPlugin({ query: 99 });
        const result = await runQuery(new RetryDbPlugin(inner, { ...immediately, attempts: 3 }));

        expect(result.ok).toBe(PluginEventResult.ERROR);
        // Attempts, not retries: three calls total rather than four.
        expect(inner.queries).toBe(3);
    });

    it("reports the LAST failure, not the first", async () => {
        const inner = new FlakyPlugin({ query: 99 });
        const result = await runQuery(new RetryDbPlugin(inner, { ...immediately, attempts: 2 }));

        expect(String(result.error)).toContain("query failure 2");
    });

    it("stops early when shouldRetry declines", async () => {
        const inner = new FlakyPlugin({ query: 99 });
        const result = await runQuery(new RetryDbPlugin(inner, {
            ...immediately,
            attempts: 5,
            shouldRetry: () => false,
        }));

        expect(result.ok).toBe(PluginEventResult.ERROR);
        expect(inner.queries).toBe(1);
    });

    it("passes the attempt number to shouldRetry", async () => {
        const inner = new FlakyPlugin({ query: 99 });
        const seen: number[] = [];

        await runQuery(new RetryDbPlugin(inner, {
            ...immediately,
            attempts: 3,
            shouldRetry: (_error, attempt) => { seen.push(attempt); return true; },
        }));

        // Asked after attempts 1 and 2. Never after the last, where the answer cannot matter.
        expect(seen).toEqual([1, 2]);
    });

    it("never retries a save", async () => {
        const inner = new FlakyPlugin({ persist: 99 });
        const result = await runPersist(new RetryDbPlugin(inner, { ...immediately, attempts: 5 }));

        // The whole point of the wrapper's restraint: a repeated bulkPersist can duplicate
        // adds, because an identity is assigned by the database rather than sent with the row.
        expect(result.ok).toBe(PluginEventResult.ERROR);
        expect(inner.persists).toBe(1);
    });

    it("never retries a destroy", async () => {
        const inner = new FlakyPlugin();
        const plugin = new RetryDbPlugin(inner, { ...immediately, attempts: 5 });

        await new Promise<void>(resolve => plugin.destroy(destroyEvent, () => resolve()));

        expect(inner.destroys).toBe(1);
    });

    it("treats zero attempts as one rather than never calling the plugin", async () => {
        const inner = new FlakyPlugin();

        await runQuery(new RetryDbPlugin(inner, { ...immediately, attempts: 0 }));

        // Reporting a failure the inner plugin never had a chance to produce would be a lie.
        expect(inner.queries).toBe(1);
    });

    it("waits between attempts using the supplied delay", async () => {
        const inner = new FlakyPlugin({ query: 2 });
        const delays: number[] = [];

        await runQuery(new RetryDbPlugin(inner, {
            attempts: 3,
            delayMs: attempt => { delays.push(attempt); return 0; },
        }));

        // Asked for the delay BEFORE attempts 2 and 3.
        expect(delays).toEqual([2, 3]);
    });
});
