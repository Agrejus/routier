import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from '../DataStore';
import { s } from '@routier/core/schema';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { Queryable } from './Queryable';
import { MemoryPlugin } from '@routier/memory-plugin';

const productsSchema = s.define("queryableProducts", {
    id: s.number().key(),
    name: s.string(),
    category: s.string(),
    price: s.number(),
}).compile();

const computedSchema = s.define("queryableComputed", {
    id: s.number().key(),
    name: s.string(),
    category: s.string(),
}).modify(x => ({
    displayName: x.computed(entity => `${entity.name}-${entity.category}`),
})).compile();

class QueryRoutingProbePlugin implements IDbPlugin {
    queryEvents: DbPluginQueryEvent<any, any>[] = [];
    bulkPersistEvents: DbPluginBulkPersistEvent[] = [];
    destroyEvents: DbPluginEvent[] = [];
    queryResponseValue: unknown = [];
    private readonly memoryPlugin = new MemoryPlugin("query-routing-probe");
    useMemoryQueryDelegate = false;

    seed<TEntity extends {}>(schema: typeof productsSchema | typeof computedSchema | any, data: TEntity[]) {
        this.useMemoryQueryDelegate = true;
        this.memoryPlugin.seed(schema, data);
    }

    query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queryEvents.push(event);

        if (this.useMemoryQueryDelegate) {
            this.memoryPlugin.query(event, done);
            return;
        }

        done(PluginEventResult.success(event.id, new TranslatedArrayValue(this.queryResponseValue, false) as unknown as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.bulkPersistEvents.push(event);
        done(PluginEventResult.success(event.id, event.operation.toResult()));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroyEvents.push(event);
        this.memoryPlugin.destroy(event, () => {
            done(PluginEventResult.success(event.id, undefined as never));
        });
    }
}

class QueryableStore extends DataStore {
    products = this.collection(productsSchema).create();
    computedProducts = this.collection(computedSchema).create();
}

const lastQueryEvent = (plugin: QueryRoutingProbePlugin) => {
    const event = plugin.queryEvents.at(-1);
    expect(event).toBeDefined();
    return event as DbPluginQueryEvent<any, any>;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const stores: DataStore[] = [];

const trackStore = <T extends DataStore>(store: T) => {
    stores.push(store);
    return store;
};

describe("Queryable routing contracts", () => {
    afterEach(() => {
        for (const store of stores.splice(0)) {
            store[Symbol.dispose]();
        }
    });

    it("routes where+sort+skip+take options to plugin.query", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        await store.products
            .where(x => x.category === "office")
            .sortDescending(x => x.price)
            .skip(2)
            .take(5)
            .toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.action).toBe("query");
        expect(event.source).toBe("Collection");
        expect(event.operation.options.get("filter").length).toBe(1);
        expect(event.operation.options.get("sort").length).toBe(1);
        expect(event.operation.options.get("skip")[0]?.option.value).toBe(2);
        expect(event.operation.options.get("take")[0]?.option.value).toBe(5);
    });

    it("routes parameterized where with params payload", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        await store.products
            .where(([x, p]) => x.category === p.category, { category: "office" })
            .toArrayAsync();

        const event = lastQueryEvent(plugin);
        const filter = event.operation.options.get("filter")[0];
        expect(filter).toBeDefined();
        expect(filter.option.value.params).toEqual({ category: "office" });
    });

    it("routes aggregate queries with required options", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        plugin.queryResponseValue = 0;
        await store.products.sumAsync(x => x.price);
        let event = lastQueryEvent(plugin);
        expect(event.operation.options.get("map").length).toBe(1);
        expect(event.operation.options.get("sum").length).toBe(1);

        plugin.queryResponseValue = 0;
        await store.products.countAsync();
        event = lastQueryEvent(plugin);
        expect(event.operation.options.get("count").length).toBe(1);

        plugin.queryResponseValue = [];
        await store.products.distinctAsync();
        event = lastQueryEvent(plugin);
        expect(event.operation.options.get("distinct").length).toBe(1);
    });

    it("routes first/firstOrUndefined/some with take(1) semantics", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        plugin.queryResponseValue = [{ id: 1, name: "A", category: "office", price: 1 }];
        await store.products.firstAsync();
        let event = lastQueryEvent(plugin);
        expect(event.operation.options.get("take")[0]?.option.value).toBe(1);

        plugin.queryResponseValue = [];
        await store.products.firstOrUndefinedAsync();
        event = lastQueryEvent(plugin);
        expect(event.operation.options.get("take")[0]?.option.value).toBe(1);

        plugin.queryResponseValue = [];
        await store.products.someAsync();
        event = lastQueryEvent(plugin);
        expect(event.operation.options.get("take")[0]?.option.value).toBe(1);
    });

    it("supports detached method usage (method binding contract)", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));
        const queryable = store.products.toQueryable();
        const where = queryable.where;

        await where(x => x.category === "office").toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter").length).toBe(1);
    });

    it("routes composed query builders through apply()", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        const byCategory = (category: string) =>
            Queryable.compose(store.products.schema)
                .where(([x, p]) => x.category === p.category, { category })
                .take(3);

        await store.products.apply(byCategory("office")).toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter").length).toBe(1);
        expect(event.operation.options.get("take")[0]?.option.value).toBe(3);
    });

    it("routes unmapped/computed filters to memory (database query has no filter)", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));

        await store.computedProducts.where(x => x.displayName === "A-office").toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter").length).toBe(0);
    });

    it("subscribe().toArray returns an unsubscribe function", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = trackStore(new QueryableStore(plugin));
        let callbackCalled = false;

        const unsub = store.products
            .toQueryable()
            .subscribe()
            .toArray((r) => {
                if (r.ok === "error") {
                    throw r.error;
                }
                callbackCalled = true;
            });

        expect(typeof unsub).toBe("function");
        expect(callbackCalled).toBe(true);
        unsub();
    });

    it("splits scoped database filters from computed memory filters", async () => {
        const plugin = new QueryRoutingProbePlugin();

        const scopedComputedSchema = s.define("scopedQueryableComputed", {
            id: s.number().key(),
            name: s.string(),
            category: s.string(),
        }).modify((x) => ({
            displayName: x.computed((entity) => `${entity.name}-${entity.category}`),
        })).compile();

        class ScopedComputedStore extends DataStore {
            products = this.collection(scopedComputedSchema)
                .scope((x) => x.category === "office")
                .create();
        }

        plugin.seed(scopedComputedSchema, [
            { id: 1, name: "Desk", category: "office" },
            { id: 2, name: "Chair", category: "office" },
            { id: 3, name: "Shovel", category: "garden" },
        ]);

        const store = trackStore(new ScopedComputedStore(plugin));
        const result = await store.products
            .where((x) => x.displayName === "Desk-office")
            .toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter")).toHaveLength(1);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Desk");
        expect(result[0].category).toBe("office");
    });

    it("re-queries subscribed results only when incoming changes match the filter", async () => {
        const plugin = new QueryRoutingProbePlugin();
        plugin.seed(productsSchema, [
            { id: 1, name: "Desk", category: "office", price: 10 },
            { id: 2, name: "Shovel", category: "garden", price: 20 },
        ]);

        const store = trackStore(new QueryableStore(plugin));
        let callbackCount = 0;
        const sender = productsSchema.createSubscription();

        const unsub = store.products
            .where((x) => x.category === "office")
            .subscribe()
            .toArray((r) => {
                if (r.ok === "error") {
                    throw r.error;
                }

                callbackCount++;
            });

        expect(callbackCount).toBe(1);
        expect(plugin.queryEvents).toHaveLength(1);

        sender.send({
            adds: [{ id: 3, name: "Rake", category: "garden", price: 30 }],
            updates: [],
            removals: [],
            unknown: [],
        });

        await flush();

        expect(callbackCount).toBe(1);
        expect(plugin.queryEvents).toHaveLength(1);

        sender.send({
            adds: [{ id: 4, name: "Lamp", category: "office", price: 40 }],
            updates: [],
            removals: [],
            unknown: [],
        });

        await flush();

        expect(callbackCount).toBe(2);
        expect(plugin.queryEvents).toHaveLength(2);

        unsub();
        sender[Symbol.dispose]();
    });
});
