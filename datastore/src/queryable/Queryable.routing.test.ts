import { describe, expect, it } from '@jest/globals';
import { DataStore } from '../DataStore';
import { s } from '@routier/core/schema';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { Queryable } from './Queryable';

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

    query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queryEvents.push(event);
        done(PluginEventResult.success(event.id, new TranslatedArrayValue(this.queryResponseValue, false) as unknown as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.bulkPersistEvents.push(event);
        done(PluginEventResult.success(event.id, event.operation.toResult()));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroyEvents.push(event);
        done(PluginEventResult.success(event.id, undefined as never));
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

describe("Queryable routing contracts", () => {
    it("routes where+sort+skip+take options to plugin.query", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = new QueryableStore(plugin);

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
        const store = new QueryableStore(plugin);

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
        const store = new QueryableStore(plugin);

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
        const store = new QueryableStore(plugin);

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
        const store = new QueryableStore(plugin);
        const queryable = store.products.toQueryable();
        const where = queryable.where;

        await where(x => x.category === "office").toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter").length).toBe(1);
    });

    it("routes composed query builders through apply()", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = new QueryableStore(plugin);

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
        const store = new QueryableStore(plugin);

        await store.computedProducts.where(x => x.displayName === "A-office").toArrayAsync();

        const event = lastQueryEvent(plugin);
        expect(event.operation.options.get("filter").length).toBe(0);
    });

    it("subscribe().toArray returns an unsubscribe function", async () => {
        const plugin = new QueryRoutingProbePlugin();
        const store = new QueryableStore(plugin);
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
});
