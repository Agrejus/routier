import { afterEach, describe, expect, it } from '@jest/globals';
import { DataStore } from './DataStore';
import { InferType, s } from '@routier/core/schema';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, TranslatedArrayValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';

const productSchema = s.define("integrationProducts", {
    id: s.number().key(),
    name: s.string(),
    category: s.string(),
}).compile();
type Product = InferType<typeof productSchema>;

const toEchoPersistResult = (changes: DbPluginBulkPersistEvent["operation"]) => {
    const result = new BulkPersistResult();

    for (const [schemaId, schemaChanges] of changes) {
        const schemaResult = result.resolve(schemaId);
        schemaResult.adds = [...schemaChanges.adds] as any[];
        schemaResult.updates = schemaChanges.updates.map((update) => update.entity) as any[];
        schemaResult.removes = [...schemaChanges.removes] as any[];
    }

    return result;
};

class RoutingProbePlugin implements IDbPlugin {
    queryEvents: DbPluginQueryEvent<any, any>[] = [];
    bulkPersistEvents: DbPluginBulkPersistEvent[] = [];
    destroyEvents: DbPluginEvent[] = [];
    queryResponseValue: unknown = [];
    queryResponseFactory?: () => unknown;
    bulkPersistHandler?: (event: DbPluginBulkPersistEvent) => BulkPersistResult;
    bulkPersistError?: Error;

    query<TRoot extends {}, TShape = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queryEvents.push(event);
        const value = this.queryResponseFactory != null ? this.queryResponseFactory() : this.queryResponseValue;
        done(PluginEventResult.success(event.id, new TranslatedArrayValue(value, false) as unknown as ITranslatedValue<TShape>));
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.bulkPersistEvents.push(event);

        if (this.bulkPersistError != null) {
            done(PluginEventResult.error(event.id, this.bulkPersistError));
            return;
        }

        const result = this.bulkPersistHandler != null ? this.bulkPersistHandler(event) : toEchoPersistResult(event.operation);
        done(PluginEventResult.success(event.id, result));
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.destroyEvents.push(event);
        done(PluginEventResult.success(event.id, undefined as never));
    }
}

class IntegrationStore extends DataStore {
    products = this.collection(productSchema).create();
}

const stores: DataStore[] = [];
const createStore = (plugin: IDbPlugin) => {
    const store = new IntegrationStore(plugin);
    stores.push(store);
    return store;
};

describe("DataStore integration", () => {
    afterEach(() => {
        for (const store of stores.splice(0)) {
            store[Symbol.dispose]();
        }
    });

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

    it("previewChangesAsync does not clear dirty updates before save", async () => {
        const plugin = new RoutingProbePlugin();
        const store = createStore(plugin);
        const [added] = await store.products.addAsync({
            id: 20,
            name: "Draft",
            category: "office",
        });

        await store.saveChangesAsync();
        added.name = "Updated Draft";

        const firstPreview = await store.previewChangesAsync();
        const secondPreview = await store.previewChangesAsync();
        const firstChanges = firstPreview.get(productSchema.id);
        const secondChanges = secondPreview.get(productSchema.id);

        expect(firstChanges?.updates).toHaveLength(1);
        expect(secondChanges?.updates).toHaveLength(1);
        expect(firstChanges?.updates[0].changeType).toBe("propertiesChanged");
        expect(await store.hasChangesAsync()).toBe(true);
    });

    it("preserves pending changes when plugin.bulkPersist fails", async () => {
        const plugin = new RoutingProbePlugin();
        plugin.bulkPersistError = new Error("persist failed");
        const store = createStore(plugin);

        await store.products.addAsync({
            id: 30,
            name: "Will Retry",
            category: "office",
        });

        await expect(store.saveChangesAsync()).rejects.toThrow("persist failed");

        const preview = await store.previewChangesAsync();
        const changes = preview.get(productSchema.id);

        expect(changes?.adds).toHaveLength(1);
        expect(await store.hasChangesAsync()).toBe(true);
    });

    it("merges persisted add results back into tracked entities", async () => {
        const plugin = new RoutingProbePlugin();
        plugin.bulkPersistHandler = (event) => {
            const result = new BulkPersistResult();
            const schemaResult = result.resolve(productSchema.id);
            const add = event.operation.get(productSchema.id)?.adds[0] as unknown as Product | undefined;

            schemaResult.adds = [{
                ...add,
                name: "Persisted Name",
                category: "saved",
            } as any];

            return result;
        };

        const store = createStore(plugin);
        const [added] = await store.products.addAsync({
            id: 40,
            name: "Pending Name",
            category: "office",
        });

        await store.saveChangesAsync();

        expect(added.name).toBe("Persisted Name");
        expect(added.category).toBe("saved");
        expect(store.products.attachments.get(added)).toBe(added);
        expect(await store.hasChangesAsync()).toBe(false);
    });

    it("stages removals and clears them after a successful save", async () => {
        const plugin = new RoutingProbePlugin();
        const store = createStore(plugin);
        const [added] = await store.products.addAsync({
            id: 50,
            name: "To Remove",
            category: "office",
        });

        await store.saveChangesAsync();
        await store.products.removeAsync(added);

        const preview = await store.previewChangesAsync();
        const changes = preview.get(productSchema.id);

        expect(changes?.removes).toHaveLength(1);

        await store.saveChangesAsync();

        const afterSave = await store.previewChangesAsync();
        expect(afterSave.get(productSchema.id)).toBeUndefined();
        expect(await store.hasChangesAsync()).toBe(false);
    });

    it("reuses canonical attachments when the same entity is attached again", async () => {
        const plugin = new RoutingProbePlugin();
        const store = createStore(plugin);

        const [first] = store.products.attachments.set({
            id: 60,
            name: "Original",
            category: "office",
        } as Product);

        const [second] = store.products.attachments.set({
            id: 60,
            name: "Merged",
            category: "supplies",
        } as Product);

        expect(second).toBe(first);
        expect(first.name).toBe("Merged");
        expect(first.category).toBe("supplies");
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
