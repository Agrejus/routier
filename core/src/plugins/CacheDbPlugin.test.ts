import { BulkPersistChanges, BulkPersistResult } from "../collections";
import { toExpression } from "../expressions";
import { CompiledSchema, s } from "../schema";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from "../results";
import { CacheDbPlugin } from "./CacheDbPlugin";
import { Query, QueryOptionsCollection } from "./query";
import { ITranslatedValue, TranslatedArrayValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";

/**
 * The cache, driven with REAL query objects rather than stubs.
 *
 * Keying is the part that fails quietly. A key that ignores the filter serves one query's rows
 * for another; a key built from the expression tree throws on a `PropertyInfo`'s functions.
 * Both are only visible if the queries under test actually differ, so these build genuine
 * `Query` objects over a compiled schema.
 */

const schema = s.define("cache_products", {
    id: s.string().key().identity(),
    name: s.string(),
    price: s.number(),
}).compile();

const otherSchema = s.define("cache_orders", {
    id: s.string().key().identity(),
    total: s.number(),
}).compile();

/** Returns a distinct row per call, so a hit and a miss are told apart by the DATA. */
class CountingPlugin implements IDbPlugin {

    readonly databaseName = "test-db";

    queries = 0;
    persists = 0;

    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.queries++;

        done(PluginEventResult.success(
            event.id,
            new TranslatedArrayValue([{ call: this.queries }], false) as unknown as ITranslatedValue<TShape>
        ));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.persists++;
        done(PluginEventResult.success(event.id, new BulkPersistResult()));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        done(PluginEventResult.success(event.id));
    }
}

const eventFor = (target: CompiledSchema<any>, filter?: (x: any) => boolean): DbPluginQueryEvent<any, any> => {
    const options = new QueryOptionsCollection<any>();

    if (filter != null) {
        options.add("filter", { filter, expression: toExpression(target, filter), params: undefined });
    }

    return {
        id: "q",
        operation: new Query(options as never, target),
        schemas: { get: () => target } as never,
        source: "test",
        action: "query",
        explain: false,
        executedQueries: [],
    };
};

const read = (plugin: CacheDbPlugin, event: DbPluginQueryEvent<any, any>) =>
    new Promise<any>(resolve => plugin.query(event, resolve as never));

const persistEventFor = (target: CompiledSchema<any>): DbPluginBulkPersistEvent => {
    const changes = new BulkPersistChanges();
    changes.resolve(target.id);

    return { id: "p", operation: changes, schemas: { get: () => target } as never, source: "test", action: "persist" };
};

const write = (plugin: CacheDbPlugin, event: DbPluginBulkPersistEvent) =>
    new Promise<any>(resolve => plugin.bulkPersist(event, resolve as never));

describe("CacheDbPlugin", () => {

    it("asks the inner plugin once for a repeated query", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);
        const event = eventFor(schema, (x: any) => x.price > 10);

        const first = await read(cache, event);
        const second = await read(cache, event);

        expect(inner.queries).toBe(1);
        expect(second.data.value).toEqual(first.data.value);
    });

    it("treats a different filter as a different query", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);

        await read(cache, eventFor(schema, (x: any) => x.price > 10));
        await read(cache, eventFor(schema, (x: any) => x.price > 20));

        // The failure this prevents is serving one filter's rows for another.
        expect(inner.queries).toBe(2);
    });

    it("treats a different schema as a different query", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);

        await read(cache, eventFor(schema));
        await read(cache, eventFor(otherSchema));

        expect(inner.queries).toBe(2);
    });

    it("hands back a fresh value each time, not the cached one", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);
        const event = eventFor(schema);

        const first = await read(cache, event);

        // `forEach` on a translated array REASSIGNS its slots — this is what the change
        // tracker does to swap in attached entities. If the cache handed out its own array,
        // this would replace what every later hit returns.
        first.data.forEach(() => ({ replaced: true }));

        const second = await read(cache, event);

        expect(second.data.value).toEqual([{ call: 1 }]);
    });

    it("preserves the translated value's class on a hit", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);
        const event = eventFor(schema);

        await read(cache, event);
        const hit = await read(cache, event);

        // A plain object would satisfy the interface and break `forEach`, which the datastore
        // calls on every result.
        expect(hit.data).toBeInstanceOf(TranslatedArrayValue);
        expect(hit.data.isTransformed).toBe(false);
    });

    it("invalidates a schema when it is written", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);
        const event = eventFor(schema);

        await read(cache, event);
        await write(cache, persistEventFor(schema));
        const afterWrite = await read(cache, event);

        expect(inner.queries).toBe(2);
        expect(afterWrite.data.value).toEqual([{ call: 2 }]);
    });

    it("leaves other schemas cached when one is written", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);

        await read(cache, eventFor(schema));
        await read(cache, eventFor(otherSchema));
        await write(cache, persistEventFor(schema));

        await read(cache, eventFor(otherSchema));

        // Three: two misses plus the re-read of the untouched schema being a hit.
        expect(inner.queries).toBe(2);
    });

    it("invalidates even when the save fails", async () => {
        const inner = new CountingPlugin();
        const failing: IDbPlugin = {
            databaseName: inner.databaseName,
            query: inner.query.bind(inner),
            bulkPersist: (event, done) => done(PluginEventResult.error(event.id, new Error("nope"))),
            destroy: inner.destroy.bind(inner),
        };
        const cache = new CacheDbPlugin(failing);
        const event = eventFor(schema);

        await read(cache, event);
        await write(cache, persistEventFor(schema));
        await read(cache, event);

        // A backend without atomic batches can apply part of a failed save, so keeping the
        // cache because the call reported an error would serve rows that are wrong.
        expect(inner.queries).toBe(2);
    });

    it("evicts the least recently used entry past the limit", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner, { max: 2 });

        const a = eventFor(schema, (x: any) => x.price > 1);
        const b = eventFor(schema, (x: any) => x.price > 2);
        const c = eventFor(schema, (x: any) => x.price > 3);

        await read(cache, a);
        await read(cache, b);
        await read(cache, a);   // a is now the most recent, so b is the oldest
        await read(cache, c);   // evicts b

        await read(cache, a);
        expect(inner.queries).toBe(3);

        await read(cache, b);
        expect(inner.queries).toBe(4);
    });

    it("clears everything on destroy", async () => {
        const inner = new CountingPlugin();
        const cache = new CacheDbPlugin(inner);
        const event = eventFor(schema);

        await read(cache, event);
        await new Promise<void>(resolve => cache.destroy({ id: "d" } as never, () => resolve()));
        await read(cache, event);

        expect(inner.queries).toBe(2);
    });
});
