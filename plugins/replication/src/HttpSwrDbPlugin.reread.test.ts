import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import { installFetchMock, waitFor } from './__tests__/httpTestKit';

const schema = s.define('swrReread', {
    id: s.string().key(),
    note: s.string().nullable(),
    label: s.string().optional(),
}).compile();

describe.each(['proxy', 'diff'] as const)('HttpSwrDbPlugin revalidation into a %s collection', mode => {
    let http: ReturnType<typeof installFetchMock>;
    let serverRow: Record<string, unknown>;

    beforeEach(() => {
        http = installFetchMock();
        serverRow = { id: 'a', note: 'x', label: 'y' };
        http.respondToGet(() => ({ status: 200, body: [serverRow] }));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const store = () => {
        const plugin = new HttpSwrDbPlugin(new MemoryPlugin(`swr-${uuid(8)}`), {
            getUrl: collection => `https://api.test/${collection}`,
            unsyncedQueueStore: new MemoryPlugin(`queue-${uuid(8)}`),
            maxAgeMs: 0,
        });

        class ProxyStore extends DataStore {
            things = this.collection(schema).proxy().create();
        }

        class DiffStore extends DataStore {
            things = this.collection(schema).diff().create();
        }

        return mode === 'proxy' ? new ProxyStore(plugin) : new DiffStore(plugin);
    };

    it('clears values the server set to null or removed', async () => {
        const dataStore = store();
        await dataStore.things.firstAsync(x => x.id === 'a');

        serverRow = { id: 'a', note: null };
        const gets = http.gets.length;
        await dataStore.things.firstAsync(x => x.id === 'a');
        await waitFor(() => http.gets.length > gets, 'the revalidation');

        await waitFor(async () => (await dataStore.things.firstAsync(x => x.id === 'a')).note === null, 'the re-read to take the null');
        const row = await dataStore.things.firstAsync(x => x.id === 'a');

        expect(row.note).toBeNull();
        expect(row.label).toBeUndefined();
        expect(await dataStore.hasChangesAsync()).toBe(false);
    });
});
