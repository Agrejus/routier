import { describe, expect, it } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { DataStore } from '../DataStore';

const coded = s.define('keychange_rows', { code: s.string().key(), label: s.string() }).compile();
const numbered = s.define('keychange_identity', { id: s.number().key().identity(), label: s.string() }).compile();

class Store extends DataStore {
    rows = this.collection(coded).proxy().create();
    numbered = this.collection(numbered).proxy().create();
}

class DiffStore extends DataStore {
    rows = this.collection(coded).diff().create();
}

const keyError = /Cannot change the key of a tracked entity in keychange_(rows|identity)/;

describe('changing the key of a tracked proxy entity', () => {
    it('rejects the save with an error that says so', async () => {
        const store = new Store(new MemoryPlugin(`keychange-${uuid(8)}`));
        await store.rows.addAsync({ code: 'a', label: 'x' });
        await store.saveChangesAsync();

        const [row] = await store.rows.toArrayAsync();
        row.code = 'b';

        await expect(store.saveChangesAsync()).rejects.toThrow(
            'Cannot change the key of a tracked entity in keychange_rows: "a" became "b". A key identifies the row, so remove the entity and add a new one instead.'
        );
    });

    it('writes nothing, including other changes in the same save', async () => {
        const name = `keychange-${uuid(8)}`;
        const store = new Store(new MemoryPlugin(name));
        await store.rows.addAsync({ code: 'a', label: 'x' }, { code: 'c', label: 'y' });
        await store.saveChangesAsync();

        const rows = await store.rows.sort(row => row.code).toArrayAsync();
        rows[0].code = 'b';
        rows[1].label = 'changed';
        await store.saveChangesAsync().catch(() => undefined);

        const stored = await new Store(new MemoryPlugin(name)).rows.sort(row => row.code).toArrayAsync();
        expect(stored).toEqual([{ code: 'a', label: 'x' }, { code: 'c', label: 'y' }]);
    });

    it('rejects a changed identity the same way', async () => {
        const store = new Store(new MemoryPlugin(`keychange-${uuid(8)}`));
        await store.numbered.addAsync({ label: 'x' });
        await store.saveChangesAsync();

        const [row] = await store.numbered.toArrayAsync();
        row.id = row.id + 100;

        await expect(store.saveChangesAsync()).rejects.toThrow(keyError);
    });

    it('still saves an ordinary change', async () => {
        const name = `keychange-${uuid(8)}`;
        const store = new Store(new MemoryPlugin(name));
        await store.rows.addAsync({ code: 'a', label: 'x' });
        await store.saveChangesAsync();

        const [row] = await store.rows.toArrayAsync();
        row.label = 'changed';
        await store.saveChangesAsync();

        expect(await new Store(new MemoryPlugin(name)).rows.toArrayAsync()).toEqual([{ code: 'a', label: 'changed' }]);
    });

    it('rejects a key changed alongside another value in diff mode', async () => {
        const store = new DiffStore(new MemoryPlugin(`keychange-${uuid(8)}`));
        await store.rows.addAsync({ code: 'a', label: 'x' });
        await store.saveChangesAsync();

        const [row] = await store.rows.toArrayAsync();
        row.code = 'b';
        row.label = 'changed';

        await expect(store.saveChangesAsync()).rejects.toThrow(keyError);
    });
});
