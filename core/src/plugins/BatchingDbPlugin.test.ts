import { BulkPersistChanges, BulkPersistResult, SchemaCollection, SchemaPersistResult } from "../collections";
import { PluginDestroyedError } from "../errors";
import { CompiledSchema, s } from "../schema";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { BatchingDbPlugin } from "./BatchingDbPlugin";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

const products = s.define("batching_products", {
    id: s.string().key().identity(),
    name: s.string(),
}).compile();

const orders = s.define("batching_orders", {
    id: s.string().key().identity(),
    total: s.number(),
}).compile();

const third = s.define("batching_invoices", {
    id: s.string().key().identity(),
    amount: s.number(),
}).compile();

/**
 * Answers on a later tick, so several writes are genuinely in flight together — the whole
 * mechanism only engages when a write arrives while another is running, and a synchronous
 * inner plugin can never produce that.
 */
class SlowPlugin implements IDbPlugin {

    readonly databaseName = "batching-test-db";

    /** One entry per bulkPersist the wrapper actually issued — the count that proves batching. */
    readonly writes: DbPluginBulkPersistEvent[] = [];
    /** Schema ids that must fail, to exercise the fallback. */
    failFor = new Set<string>();
    /** Echoes one row per schema, so a mis-split hands a caller another's rows. */
    echo = true;

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        done(PluginEventResult.success(event.id, [] as unknown as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.writes.push(event);

        const schemaIds = [...event.operation.keys()].map(String);
        const failing = schemaIds.find(id => this.failFor.has(id));

        setTimeout(() => {

            if (failing != null) {
                done(PluginEventResult.error(event.id, new Error(`refused ${failing}`)));
                return;
            }

            const result = new BulkPersistResult();

            if (this.echo) {
                for (const schemaId of event.operation.keys()) {
                    const echoed = new SchemaPersistResult();
                    echoed.adds.push({ from: String(schemaId) } as never);
                    result.set(schemaId, echoed);
                }
            }

            done(PluginEventResult.success(event.id, result));
        }, 5);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.writes.push(event as DbPluginBulkPersistEvent);
        done(PluginEventResult.success(event.id));
    }
}

let eventCounter = 0;

const persistEvent = (...schemas: CompiledSchema<any>[]): DbPluginBulkPersistEvent => {
    const operation = new BulkPersistChanges();
    const collection = new SchemaCollection();

    for (const schema of schemas) {
        operation.resolve(schema.id);
        collection.set(schema.id, schema as never);
    }

    return {
        id: `event-${++eventCounter}`,
        operation,
        schemas: collection,
        source: "test",
        action: "persist",
    };
};

const write = (plugin: BatchingDbPlugin, event: DbPluginBulkPersistEvent) =>
    new Promise<any>(resolve => plugin.bulkPersist(event, resolve as never));

const destroy = (plugin: BatchingDbPlugin) =>
    new Promise<any>(resolve => plugin.destroy(
        { id: "d", schemas: new SchemaCollection(), source: "test", action: "destroy" },
        resolve as never
    ));

describe("BatchingDbPlugin", () => {

    describe("merging", () => {

        it("merges the writes that arrive WHILE one is in flight", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // The first write never waits — that is the property that makes this wrapper cost
            // nothing — so it goes out alone and only the two behind it can merge. Three
            // concurrent saves over distinct schemas are therefore TWO round trips, not one.
            const results = await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(orders)),
                write(plugin, persistEvent(third)),
            ]);

            for (const result of results) {
                expect(result.ok).toBe(PluginEventResult.SUCCESS);
            }

            // Without this assertion the suite passes just as happily with a wrapper that
            // queues and never merges.
            expect(inner.writes.length).toBe(2);
            expect(new Set(inner.writes[1].operation.keys())).toEqual(new Set([orders.id, third.id]));
        });

        it("does NOT merge writes that share a schema", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // Two writers to one collection. Merging them would regroup their operations —
            // removes, then updates, then adds — and an add followed by an update of the same
            // row would run the update first, against a row that does not exist yet.
            await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(products)),
            ]);

            expect(inner.writes.length).toBe(2);
        });

        it("keeps arrival order across groups rather than fitting later items into earlier ones", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // A(products), B(products), C(orders). First-fit would put C in A's group and write
            // it BEFORE the earlier-arrived B. Append-only keeps C with B.
            const a = persistEvent(products);
            const b = persistEvent(products);
            const c = persistEvent(orders);

            await Promise.all([write(plugin, a), write(plugin, b), write(plugin, c)]);

            expect(inner.writes.length).toBe(2);
            expect([...inner.writes[0].operation.keys()]).toEqual([products.id]);
            expect(new Set(inner.writes[1].operation.keys())).toEqual(new Set([products.id, orders.id]));
        });

        it("gives every caller its OWN rows and its OWN event id", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // Three, so the last two genuinely MERGE — with two the first goes alone and each
            // result passes straight back, which would exercise nothing.
            const primer = persistEvent(products);
            const first = persistEvent(orders);
            const second = persistEvent(third);

            const [, a, b] = await Promise.all([
                write(plugin, primer),
                write(plugin, first),
                write(plugin, second),
            ]);

            // Split by schema, so neither caller can receive the other's database-assigned rows,
            // and neither is handed the synthetic id the merged write ran under.
            expect(a.id).toBe(first.id);
            expect(b.id).toBe(second.id);
            expect(a.data.get(orders.id).adds).toEqual([{ from: String(orders.id) }]);
            expect(a.data.has(third.id)).toBe(false);
            expect(b.data.get(third.id).adds).toEqual([{ from: String(third.id) }]);
            expect(b.data.has(orders.id)).toBe(false);
        });

        it("gives a schema the plugin echoed nothing for an empty result, not a hole", async () => {
            const inner = new SlowPlugin();
            inner.echo = false;
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // The first write goes alone; the two behind it are the merged pair whose result
            // has to be split.
            const [, b] = await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(orders)),
                write(plugin, persistEvent(third)),
            ]);

            expect(b.data.get(orders.id)).toBeInstanceOf(SchemaPersistResult);
            expect(b.data.get(orders.id).adds).toEqual([]);
        });
    });

    describe("the batch ceiling", () => {

        it("never puts more than maxBatchSize writes in one transaction", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true, maxBatchSize: 2 });

            // Seven writes over distinct schemas, all arriving together. Without a ceiling the
            // six behind the first would go out as ONE transaction — an unbounded statement set,
            // which some engines cap outright (D1's `batch()`).
            const events = Array.from({ length: 7 }, (_, i) => persistEvent(
                s.define(`batching_ceiling_${i}`, { id: s.string().key().identity() }).compile()
            ));

            const results = await Promise.all(events.map(event => write(plugin, event)));

            for (const result of results) {
                expect(result.ok).toBe(PluginEventResult.SUCCESS);
            }

            for (const issued of inner.writes) {
                expect([...issued.operation.keys()].length).toBeLessThanOrEqual(2);
            }
        });

        it("still answers every caller when the ceiling splits them across drains", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true, maxBatchSize: 1 });

            // A ceiling of one is batching turned off by arithmetic. Everything must still be
            // answered, in one write each — the remainder must not be stranded in the queue.
            const results = await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(orders)),
                write(plugin, persistEvent(third)),
            ]);

            expect(results.map(r => r.ok)).toEqual([
                PluginEventResult.SUCCESS,
                PluginEventResult.SUCCESS,
                PluginEventResult.SUCCESS,
            ]);
            expect(inner.writes.length).toBe(3);
        });
    });

    describe("without isAtomic", () => {

        it("queues but never merges", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner);

            const results = await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(orders)),
                write(plugin, persistEvent(products)),
            ]);

            for (const result of results) {
                expect(result.ok).toBe(PluginEventResult.SUCCESS);
            }

            // The default, and what almost every caller runs. This is the only assertion that
            // tells "merging is off" from "the option is quietly ignored".
            expect(inner.writes.length).toBe(3);
        });
    });

    describe("failure", () => {

        it("re-runs a failed batch individually so one bad write cannot fail its batchmates", async () => {
            const inner = new SlowPlugin();
            inner.failFor.add(String(orders.id));
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            // products goes alone and lands; orders and third merge, and that batch fails
            // because of orders alone.
            const [a, b, c] = await Promise.all([
                write(plugin, persistEvent(products)),
                write(plugin, persistEvent(orders)),
                write(plugin, persistEvent(third)),
            ]);

            expect(a.ok).toBe(PluginEventResult.SUCCESS);
            expect(b.ok).toBe(PluginEventResult.ERROR);
            expect(b.error.message).toBe(`refused ${String(orders.id)}`);
            // The batchmate is not punished for somebody else's data.
            expect(c.ok).toBe(PluginEventResult.SUCCESS);

            // products, the failed merge, then one write per item: N+1 for a failing batch of N.
            expect(inner.writes.length).toBe(4);
        });

        it("frees the latch after a failure, so a later write still reaches the inner plugin", async () => {
            const inner = new SlowPlugin();
            inner.failFor.add(String(products.id));
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            await write(plugin, persistEvent(products));

            inner.failFor.clear();
            const after = await write(plugin, persistEvent(orders));

            // A stuck `isWriting` is a permanent, silent write outage: every later save queues
            // forever and nothing anywhere reports it.
            expect(after.ok).toBe(PluginEventResult.SUCCESS);
        });

        it("frees the latch when a caller's callback throws", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            await new Promise<void>(resolve => {
                plugin.bulkPersist(persistEvent(products), () => {
                    resolve();
                    throw new Error("a caller's done() blew up");
                });
            });

            // Let the throwing callback unwind before the next write.
            await new Promise(r => setTimeout(r, 20));

            const after = await write(plugin, persistEvent(orders));

            expect(after.ok).toBe(PluginEventResult.SUCCESS);
        });

        it("answers the other callers when one of them throws", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            const answered: string[] = [];

            const thrower = new Promise<void>(resolve => {
                plugin.bulkPersist(persistEvent(products), () => {
                    answered.push("thrower");
                    resolve();
                    throw new Error("nope");
                });
            });

            const good = new Promise<void>(resolve => {
                plugin.bulkPersist(persistEvent(orders), () => {
                    answered.push("good");
                    resolve();
                });
            });

            await Promise.all([thrower, good]);

            expect(answered).toContain("good");
        });

        it("surfaces a synchronous throw from the inner plugin to that caller", async () => {
            const exploding: IDbPlugin = {
                databaseName: "exploding",
                query: (_event, _done) => { /* unused */ },
                bulkPersist: () => { throw new Error("inner exploded"); },
                destroy: (event, done) => done(PluginEventResult.success(event.id)),
            };

            const plugin = new BatchingDbPlugin(exploding, { isAtomic: true });
            const result = await write(plugin, persistEvent(products));

            expect(result.ok).toBe(PluginEventResult.ERROR);
            expect(result.error.message).toBe("inner exploded");
        });
    });

    describe("shutdown", () => {

        it("fails queued writes and forwards destroy only after the in-flight one settles", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            const inFlight = write(plugin, persistEvent(products));

            // Queued behind the in-flight write, so it never reached the backend.
            const queued = write(plugin, persistEvent(orders));
            const destroyed = destroy(plugin);

            const [first, second, closed] = await Promise.all([inFlight, queued, destroyed]);

            expect(first.ok).toBe(PluginEventResult.SUCCESS);
            expect(second.ok).toBe(PluginEventResult.ERROR);
            expect(second.error).toBeInstanceOf(PluginDestroyedError);
            expect(second.id).toBe((await Promise.resolve(second)).id);
            expect(closed.ok).toBe(PluginEventResult.SUCCESS);

            // A stranded `done` is a promise that never resolves, which hangs a real shutdown
            // and which nothing else in this suite would notice.
            expect(inner.writes.filter(w => w.action === "persist").length).toBe(1);
        });

        it("fails a write submitted after destroy without touching the inner plugin", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            await destroy(plugin);
            const before = inner.writes.filter(w => w.action === "persist").length;

            const result = await write(plugin, persistEvent(products));

            expect(result.ok).toBe(PluginEventResult.ERROR);
            expect(result.error).toBeInstanceOf(PluginDestroyedError);
            // Passing it through would let a plugin that creates missing tables recreate the
            // database the destroy just deleted, and report success against an empty one.
            expect(inner.writes.filter(w => w.action === "persist").length).toBe(before);
        });
    });

    describe("the uncontended path", () => {

        it("reaches the inner plugin in the SAME tick", () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            plugin.bulkPersist(persistEvent(products), () => { /* unused */ });

            // The datastore's save path is synchronous up to the plugin on purpose. Deferring
            // here reintroduces a recorded defect where saves interleaved and the change
            // tracker could no longer match an addition to its echo.
            expect(inner.writes.length).toBe(1);
        });

        it("passes a lone write's own event through untouched", async () => {
            const inner = new SlowPlugin();
            const plugin = new BatchingDbPlugin(inner, { isAtomic: true });

            const event = persistEvent(products);
            await write(plugin, event);

            expect(inner.writes[0]).toBe(event);
        });
    });

    it("forwards the database name so channel scoping survives the wrapper", () => {
        expect(new BatchingDbPlugin(new SlowPlugin()).databaseName).toBe("batching-test-db");
    });
});
