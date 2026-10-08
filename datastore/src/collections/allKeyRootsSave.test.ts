import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const tags = s.define('all_key_tags', { id: s.string().key() }).compile();

class Store extends DataStore {
    tags = this.collection(tags).proxy().create();
}

describe('saving a schema whose only property is its key', () => {
    it('saves and reads the row back', async () => {
        const name = `all-keys-${uuid(8)}`;
        const store = new Store(new MemoryPlugin(name));
        await store.tags.addAsync({ id: 'a' });
        await store.saveChangesAsync();

        expect(await new Store(new MemoryPlugin(name)).tags.toArrayAsync()).toEqual([{ id: 'a' }]);
    });
});
