import { generateData } from '@routier/test-utils';
import { afterAll, describe, expect, it } from '@jest/globals';
import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '../MemoryPlugin';
import { TestDataStore } from './datastore/MemoryDatastore';

const stores: TestDataStore[] = [];

const open = (name: string) => {
    const store = new TestDataStore(new MemoryPlugin(name));
    stores.push(store);
    return store;
};

describe('saving many rows at once', () => {
    afterAll(async () => {
        await Promise.all(stores.map(store => store.destroyAsync()));
    });

    it('saves a thousand rows in one save', async () => {
        const name = uuidv4();
        const writer = open(name);
        const items = generateData(writer.comments.schema, 1000);

        await writer.comments.addAsync(...items);
        await writer.saveChangesAsync();

        expect(await open(name).comments.countAsync()).toBe(1000);
    });
});
