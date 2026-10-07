import { afterEach, describe, expect, it } from '@jest/globals';
import { types } from 'node:util';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { BulkPersistResult } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query, QueryOptionName, QueryOptionsCollection } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from '@routier/core/results';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const renamedLabelSchema = s.define('storage_shaped_labels', {
    id: s.string().key(),
    label: s.string().from('stored_label'),
}).compile();

const renamedKeySchema = s.define('storage_shaped_keys', {
    id: s.string().key().from('_id'),
    label: s.string(),
}).compile();

class ProxyStore extends DataStore {
    labels = this.collection(renamedLabelSchema).proxy().create();
    keys = this.collection(renamedKeySchema).proxy().create();
}

class DiffStore extends DataStore {
    labels = this.collection(renamedLabelSchema).diff().create();
}

class ImmutableStore extends DataStore {
    labels = this.collection(renamedLabelSchema).immutable().create();
}

class RefusesOption implements IDbPlugin {
    constructor(private readonly inner: IDbPlugin, private readonly refused: QueryOptionName) { }

    get databaseName() { return this.inner.databaseName; }

    query<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>) {
        const options = event.operation.options;

        for (const item of options.get(this.refused)) {
            options.reportMissingCapability(item);
        }

        const executed = new QueryOptionsCollection<TShape>();

        options.forEach(option => {
            if (option.target === 'database' && option.reason === 'executed') {
                executed.add(option.name, option.value);
            }
        });

        this.inner.query({ ...event, operation: new Query<TRoot, TShape>(executed, event.operation.schema) }, done);
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>) { this.inner.destroy(event, done); }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>) { this.inner.bulkPersist(event, done); }
}

const stores: DataStore[] = [];

const open = <TStore extends DataStore>(Store: new (plugin: IDbPlugin) => TStore, wrap: (plugin: IDbPlugin) => IDbPlugin = plugin => plugin) => {
    const databaseName = `storage-shaped-${uuidv4()}`;
    const writer = new ProxyStore(new MemoryPlugin(databaseName));
    const store = new Store(wrap(new MemoryPlugin(databaseName)));

    stores.push(writer, store);

    return { writer, store };
};

const seedLabels = async (writer: ProxyStore) => {
    await writer.labels.addAsync({ id: '1', label: 'a' }, { id: '2', label: 'b' }, { id: '3', label: 'c' });
    await writer.saveChangesAsync();
};

afterEach(async () => {
    for (const store of stores.splice(0)) {
        await store.destroyAsync().catch(() => undefined);
    }
});

describe('rows read through a collection', () => {

    it('come back from a diff collection as plain entities with their declared names', async () => {
        const { writer, store } = open(DiffStore);
        await seedLabels(writer);

        const rows = await store.labels.sort(x => x.id).toArrayAsync();

        expect(rows.map(row => [types.isProxy(row), row.label])).toEqual([[false, 'a'], [false, 'b'], [false, 'c']]);
    });

    it('come back from an immutable collection as plain entities with their declared names', async () => {
        const { writer, store } = open(ImmutableStore);
        await seedLabels(writer);

        const rows = await store.labels.sort(x => x.id).toArrayAsync();

        expect(rows.map(row => [types.isProxy(row), row.label])).toEqual([[false, 'a'], [false, 'b'], [false, 'c']]);
    });

    it('come back from a proxy collection keyed by a renamed key as tracked entities', async () => {
        const { writer, store } = open(ProxyStore);
        await writer.keys.addAsync({ id: '1', label: 'a' });
        await writer.saveChangesAsync();

        const [first] = await store.keys.toArrayAsync();

        expect(types.isProxy(first)).toBe(true);
        expect(first.id).toBe('1');
    });

    it('come back as the same instance on a second read of a renamed key', async () => {
        const { writer, store } = open(ProxyStore);
        await writer.keys.addAsync({ id: '1', label: 'a' });
        await writer.saveChangesAsync();

        const [first] = await store.keys.toArrayAsync();
        const [second] = await store.keys.toArrayAsync();

        expect(second).toBe(first);
    });
});

describe('rows a plugin hands back before a projection', () => {

    it('are read by their declared names when a reported filter stops an aggregate', async () => {
        const { writer, store } = open(ProxyStore, plugin => new RefusesOption(plugin, 'filter'));
        await seedLabels(writer);

        expect(await store.labels.where(x => x.label === 'b').countAsync()).toBe(1);
    });

    it('are left as projected when the plugin ran the map before a reported option', async () => {
        const { writer, store } = open(ProxyStore, plugin => new RefusesOption(plugin, 'skip'));
        await seedLabels(writer);

        const projected = await store.labels.sort(x => x.id).map(x => x.id).skip(1).toArrayAsync();

        expect(projected).toStrictEqual(['2', '3']);
    });
});
