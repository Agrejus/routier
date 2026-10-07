import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { uuid } from '@routier/core/utilities';
import { DexiePlugin } from '@routier/dexie-plugin';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import type { SyncEvent } from './syncHooks';
import { destroyEvent, installFetchMock, queryPlugin, waitFor } from './__tests__/httpTestKit';

type Row = { id: string; name: string };

describe('two HttpSwrDbPlugin instances on one Dexie database', () => {
    let http: ReturnType<typeof installFetchMock>;
    let serverRows: Row[];
    let release: () => void;
    let gate: Promise<void>;
    let events: SyncEvent[];
    const created: HttpSwrDbPlugin[] = [];

    const closeGate = () => {
        gate = new Promise(resolve => {
            release = resolve;
        });
    };

    const tab = (databaseName: string) => {
        const plugin = new HttpSwrDbPlugin(new DexiePlugin(databaseName), {
            getUrl: collection => `https://api.test/${collection}`,
            unsyncedQueueStore: new MemoryPlugin(`queue-${uuid(8)}`),
            maxAgeMs: 0,
            onEvent: event => events.push(event),
        });
        created.push(plugin);
        return plugin;
    };

    const failedReads = () => events.filter(event => event.type === 'read' && event.ok === false);

    beforeEach(() => {
        http = installFetchMock();
        events = [];
        serverRows = [{ id: 'a', name: 'A' }];
        closeGate();
        http.respondToGet(async () => {
            await gate;
            return { status: 200, body: serverRows };
        });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await Promise.all(created.splice(0).map(plugin => new Promise<void>(resolve => plugin.destroy(destroyEvent(), () => resolve()))));
    });

    it('stores the same new rows from both tabs on a cold read', async () => {
        const databaseName = `shared-${uuid(8)}`;
        const [left, right] = [tab(databaseName), tab(databaseName)];

        const reads = Promise.all([queryPlugin(left), queryPlugin(right)]);
        release();

        await expect(reads).resolves.toEqual([[{ id: 'a', name: 'A' }], [{ id: 'a', name: 'A' }]]);
        expect(failedReads()).toEqual([]);
    });

    it('stores a row the server added from both tabs on a warm read', async () => {
        const databaseName = `shared-${uuid(8)}`;
        const [left, right] = [tab(databaseName), tab(databaseName)];
        release();
        await queryPlugin(left);
        await queryPlugin(right);

        serverRows = [...serverRows, { id: 'b', name: 'B' }];
        closeGate();
        const gets = http.gets.length;
        void queryPlugin(left);
        void queryPlugin(right);
        await waitFor(() => http.gets.length === gets + 2, 'both revalidations to reach the server');
        release();

        await waitFor(async () => (await queryPlugin(left)).length === 2 && (await queryPlugin(right)).length === 2, 'both tabs to hold the new row', 5000);
        expect(failedReads()).toEqual([]);
    });
});
