import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { s } from "@routier/core/schema";
import type { DbPluginQueryEvent, ITranslatedValue } from "@routier/core/plugins";
import { PluginEventResult, type PluginEventCallbackResult } from "@routier/core/results";
import { logger } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "../DataStore";
import type { InspectedQuery } from "./types";

const itemSchema = s.define("queryItems", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

class ItemStore extends DataStore {
    items = this.collection(itemSchema).proxy().create();
}

class FailingQueriesPlugin extends MemoryPlugin {
    override query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        done(PluginEventResult.error(event.id, "query refused"));
    }
}

const stores: DataStore[] = [];
let storeId = 0;

afterEach(() => {
    for (const store of stores.splice(0)) store[Symbol.dispose]();
    jest.restoreAllMocks();
});

function createStore(plugin: MemoryPlugin = new MemoryPlugin(`watch-queries-${++storeId}`)) {
    const store = new ItemStore(plugin);
    stores.push(store);
    return store;
}

function record(store: DataStore) {
    const queries: InspectedQuery[] = [];
    const stop = store.inspect().watchQueries(query => queries.push(query));
    return { queries, stop };
}

async function eventually(assertion: () => void): Promise<void> {
    const deadline = Date.now() + 2000;
    for (;;) {
        try {
            assertion();
            return;
        } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

describe("StoreInspection.watchQueries()", () => {
    it("reports a query the app runs, with how it ran", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        await store.items.where(item => item.price > 10).toArrayAsync();
        stop();

        expect(queries).toHaveLength(1);
        const [query] = queries;
        expect(query.sequence).toBe(1);
        expect(query.collection).toBe("queryItems");
        expect(query.live).toBe(false);
        expect(query.outcome).toEqual({ status: "success" });
        expect(query.durationMs).toBeGreaterThanOrEqual(0);
        expect(Math.abs(query.at - Date.now())).toBeLessThan(5000);
        expect(query.explanation.collection).toBe("queryItems");
        expect(query.explanation.summary.database + query.explanation.summary.memory).toBe(1);
        expect(Object.isFrozen(query)).toBe(true);
    });

    it("measures how long the query took", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        const before = performance.now();
        await store.items.toArrayAsync();
        const elapsed = performance.now() - before;
        stop();

        expect(queries[0].durationMs).toBeLessThanOrEqual(elapsed);
    });

    it("numbers queries in the order they complete", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        await store.items.toArrayAsync();
        await store.items.countAsync();
        stop();

        expect(queries.map(query => query.sequence)).toEqual([1, 2]);
    });

    it("reports a live query's first run with its duration and its re-runs without one", async () => {
        const store = createStore();
        const { queries, stop } = record(store);
        const unsubscribe = store.items.subscribe().toArray(() => undefined);
        await eventually(() => expect(queries).toHaveLength(1));

        await store.items.addAsync({ name: "one", price: 5 });
        await store.saveChangesAsync();
        await eventually(() => expect(queries).toHaveLength(2));
        unsubscribe();
        stop();

        expect(queries.map(query => query.live)).toEqual([true, true]);
        expect(queries[0].durationMs).toBeGreaterThanOrEqual(0);
        expect(queries[1].durationMs).toBeNull();
    });

    it("reports a failed query with its error", async () => {
        const store = createStore(new FailingQueriesPlugin("watch-queries-failing"));
        const { queries, stop } = record(store);

        await store.items.toArrayAsync().catch(() => undefined);
        stop();

        expect(queries).toHaveLength(1);
        expect(queries[0].outcome).toEqual({ status: "error", error: new Error("query refused") });
    });

    it("leaves out the queries inspection itself makes", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        await store.inspect().collections[0].count();
        stop();

        expect(queries).toEqual([]);
    });

    it("stops reporting once stopped", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        stop();
        await store.items.toArrayAsync();

        expect(queries).toEqual([]);
    });

    it("records nothing while nobody is watching", async () => {
        const store = createStore();
        await store.items.toArrayAsync();
        const { queries, stop } = record(store);

        await store.items.toArrayAsync();
        stop();

        expect(queries.map(query => query.sequence)).toEqual([1]);
    });

    it("keeps the app's query working when a watcher throws", async () => {
        const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
        const store = createStore();
        const { queries, stop } = record(store);
        const stopThrowing = store.inspect().watchQueries(() => {
            throw new Error("watcher exploded");
        });
        await store.items.addAsync({ name: "kept", price: 1 });
        await store.saveChangesAsync();

        const names = (await store.items.toArrayAsync()).map(item => item.name);
        stop();
        stopThrowing();

        expect(names).toEqual(["kept"]);
        expect(queries).toHaveLength(1);
        expect(logged).toHaveBeenCalledWith("A query watcher threw; the query itself was unaffected.", new Error("watcher exploded"));
    });

    it("still rejects an explained query that fails", async () => {
        const store = createStore(new FailingQueriesPlugin("watch-queries-explained-failing"));
        const { queries, stop } = record(store);

        await expect(store.items.explain().toArrayAsync()).rejects.toBeDefined();
        stop();

        expect(queries[0].outcome.status).toBe("error");
    });

    it("still hands explain() its explanation while recording", async () => {
        const store = createStore();
        const { queries, stop } = record(store);

        const explained = await store.items.explain().toArrayAsync();
        stop();

        expect(explained.data).toEqual([]);
        expect(explained.explanation).toEqual(queries[0].explanation);
    });
});
