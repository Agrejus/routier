import { describe, expect, it } from '@jest/globals';
import { DataStore } from './DataStore';
import { s } from '@routier/core/schema';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { uuidv4 } from '@routier/core/utilities';

const productSchema = s.define("integrationProducts", {
    id: s.number().key(),
    name: s.string(),
    category: s.string(),
}).compile();

class RoutingProbePlugin implements IDbPlugin {
    queryEvents: DbPluginQueryEvent<any, any>[] = [];
    bulkPersistEvents: DbPluginBulkPersistEvent[] = [];
    destroyEvents: DbPluginEvent[] = [];

    query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queryEvents.push(event);
        done(PluginEventResult.success(event.id, new TranslatedArrayValue<TShape[]>([], false) as unknown as ITranslatedValue<TShape>));
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

class IntegrationStore extends DataStore {
    products = this.collection(productSchema).create();
}

const createStore = (plugin: IDbPlugin) => new IntegrationStore(plugin);

describe("DataStore integration", () => {
    it("routes persist operations to plugin.bulkPersist with datastore context", async () => {
        const plugin = new RoutingProbePlugin();
        const store = createStore(plugin);
        await store.products.addAsync({
            id: 1,
            name: "Pending Item",
            category: "office",
        });
        await store.saveChangesAsync();

        expect(plugin.bulkPersistEvents.length).toBe(1);
        const [event] = plugin.bulkPersistEvents;
        const changes = event.operation.get(productSchema.id);

        expect(event.action).toBe("persist");
        expect(event.source).toBe("DataStore");
        expect(event.schemas.has(productSchema.id)).toBe(true);
        expect(changes?.adds.length).toBe(1);
    });

    it("previewChangesAsync prepares changes without calling plugin.bulkPersist", async () => {
        const plugin = new RoutingProbePlugin();
        const store = createStore(plugin);
        await store.products.addAsync({
            id: 10,
            name: "Pending Item",
            category: "office",
        });

        const preview = await store.previewChangesAsync();
        const changes = preview.get(productSchema.id);

        expect(changes).toBeDefined();
        expect(changes?.adds.length).toBe(1);
        expect(plugin.bulkPersistEvents.length).toBe(0);
    });

    it("routes scoped queries with both scope and user filters to plugin.query", async () => {
        const plugin = new RoutingProbePlugin();

        const scopedSchema = s.define("scopedProducts", {
            id: s.number().key(),
            category: s.string(),
            name: s.string(),
            documentType: s.string(),
        }).compile();

        class ScopedStore extends DataStore {
            products = this.collection(scopedSchema)
                .scope(x => x.documentType === "products")
                .create();
        }

        const store = new ScopedStore(plugin);
        await store.products.where(x => x.category === "office").toArrayAsync();

        expect(plugin.queryEvents.length).toBe(1);
        const [queryEvent] = plugin.queryEvents;
        const filters = queryEvent.operation.options.get("filter");
        expect(queryEvent.action).toBe("query");
        expect(queryEvent.source).toBe("Collection");
        expect(filters.length).toBe(2);
    });

    it("throws when a view schema uses an identity key", () => {
        const viewSchemaWithIdentity = s.define("invalidView", {
            id: s.string().key().identity(),
            name: s.string(),
        }).compile();

        expect(() => {
            class InvalidViewStore extends DataStore {
                badView = this.view(viewSchemaWithIdentity).derive(() => []).create();
            }
            new InvalidViewStore(new RoutingProbePlugin());
        }).toThrow("View cannot have an identty key");
    });
});
