import { afterEach, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { databaseNames } from '../databases';
import { TestDataStore } from './datastore/MemoryDatastore';
import { widgetSchema } from './schemas/widget';

const stores: TestDataStore[] = [];

const open = (name: string) => {
    const plugin = new MemoryPlugin(name);
    const store = new TestDataStore(plugin);

    stores.push(store);

    return { plugin, store };
};

const addWidget = async (store: TestDataStore) => {
    await store.widgets.addAsync({ set: 1 });
    await store.saveChangesAsync();
};

afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.destroyAsync()));
});

describe('destroy', () => {
    it('removes the database name from the registry', async () => {
        const names = [1, 2, 3].map(index => `${uuidv4()}-index-${index}`);

        for (const name of names) {
            const { store } = open(name);

            await addWidget(store);
            await store.destroyAsync();
        }

        expect(databaseNames()).toEqual(expect.not.arrayContaining(names));
    });

    it('keeps other databases', async () => {
        const kept = open(`${uuidv4()}-kept`);
        const destroyed = open(`${uuidv4()}-destroyed`);

        await addWidget(kept.store);
        await destroyed.store.destroyAsync();

        expect(kept.plugin.size).toBe(1);
        expect(databaseNames()).toContain(kept.plugin.databaseName);
    });

    it('registers the name when a plugin is created', () => {
        const { plugin } = open(`${uuidv4()}-created`);

        expect(databaseNames()).toContain(plugin.databaseName);
    });

    it('lets a destroyed plugin save again into an empty database', async () => {
        const { plugin, store } = open(`${uuidv4()}-reused`);

        await addWidget(store);
        await store.destroyAsync();

        expect(plugin.size).toBe(0);
        expect(plugin.getCollectionSize('widgets')).toBe(0);

        await addWidget(store);

        expect(plugin.size).toBe(1);
    });

    it('empties the database for every plugin that shares the name', async () => {
        const name = `${uuidv4()}-shared`;
        const first = open(name);
        const second = open(name);

        await addWidget(first.store);
        await second.store.destroyAsync();

        expect(first.plugin.size).toBe(0);
    });
});

describe('database name', () => {
    it('uses a shared default when none is given', () => {
        expect(new MemoryPlugin().databaseName).toBe('__routier-memory-plugin-db__');
    });
});

describe('collection size', () => {
    it('counts the rows a collection holds', async () => {
        const { plugin, store } = open(`${uuidv4()}-size`);

        await addWidget(store);
        await addWidget(store);

        expect(plugin.getCollectionSize('widgets')).toBe(2);
    });

    it('is zero for a collection that was never used', () => {
        const { plugin } = open(`${uuidv4()}-unused`);

        expect(plugin.getCollectionSize('widgets')).toBe(0);
    });
});

describe('seed', () => {
    it('adds the rows to the collection', () => {
        const { plugin } = open(`${uuidv4()}-seeded`);

        plugin.seed(widgetSchema, [{ id: 'a', set: 1 }, { id: 'b', set: 2 }]);

        expect(plugin.getCollectionSize('widgets')).toBe(2);
    });
});
