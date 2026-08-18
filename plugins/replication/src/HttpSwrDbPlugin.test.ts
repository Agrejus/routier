import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import type { IDbPlugin } from '@routier/core/plugins';
import type { DbPluginQueryEvent } from '@routier/core/plugins';
import type { ITranslatedValue } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { PluginEventResult } from '@routier/core/results';
import { SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';

/** An unsynced-queue store that always reports an empty queue and accepts every write. */
function emptyUnsyncedQueueStore(): IDbPlugin {
    return {
        query: ((event: any, done: any) => done(PluginEventResult.success(event.id, { value: [] }))) as any,
        bulkPersist: ((event: any, done: any) => done(PluginEventResult.success(event.id, event.operation.toResult()))) as any,
        destroy: ((_event: any, done: any) => done(PluginEventResult.success(''))) as any,
    } as IDbPlugin;
}

const testSchema = s
    .define('testCollection', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

function createEvent(): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: 'test-event',
        schemas,
        source: 'test',
        action: 'query',
        explain: false,
        executedQueries: [],
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

/**
 * A translated value that actually iterates. `forEach` is how the plugin reads rows out
 * of a result, so a stub that ignores its callback makes every row set look empty and
 * every classification assertion vacuously true.
 */
function createTranslated<T>(value: T): ITranslatedValue<T> {
    return {
        value,
        forEach: (cb: (item: unknown) => unknown) => {
            const items = Array.isArray(value) ? value : [value];
            for (let i = 0; i < items.length; i++) {
                cb(items[i]);
            }
        },
    } as ITranslatedValue<T>;
}

type SchemaChanges = { adds: unknown[]; updates: unknown[]; removes: unknown[] };

describe('HttpSwrDbPlugin persistToStore', () => {
    let mockSwrStore: IDbPlugin;
    let plugin: HttpSwrDbPlugin;
    let queryCalls: Array<{ event: DbPluginQueryEvent<any, unknown>; callback: (r: unknown) => void }>;
    let bulkPersistCalls: Array<{
        event: { operation: { get: (id: number) => SchemaChanges } };
        callback: (r: unknown) => void;
    }>;

    beforeEach(() => {
        queryCalls = [];
        bulkPersistCalls = [];
        mockSwrStore = {
            databaseName: 'swr-test-db',
            query: jest.fn((event: any, done: any) => {
                queryCalls.push({ event, callback: done });
            }) as any,
            bulkPersist: jest.fn((event: any, done: any) => {
                bulkPersistCalls.push({
                    event,
                    callback: done,
                });
                done(PluginEventResult.success(event.id, event.operation.toResult()));
            }) as any,
            destroy: jest.fn((_event: any, done: any) => done(PluginEventResult.success(''))) as any,
        };
        plugin = new HttpSwrDbPlugin(mockSwrStore, {
            getUrl: () => 'https://example.com/api',
            // Required: UnsyncedQueue has no default store. These tests exercise
            // persistToStore's classification, so the queue is stubbed empty rather than
            // backed by a real plugin — a real one would need the reserved
            // _routier_unsynced collection registered, and its query traffic would
            // interleave with the mockSwrStore calls the assertions index into.
            unsyncedQueueStore: emptyUnsyncedQueueStore(),
        });
    });

    /**
     * `persistToStore` runs under the per-collection store mutex, so the store query
     * fires a microtask after the call. Waiting for it is what lets the returned
     * promise settle.
     */
    function persistToStore(event: DbPluginQueryEvent<any, unknown>, translated: ITranslatedValue<unknown>) {
        return (plugin as any).persistToStore(event, translated) as Promise<void>;
    }

    async function waitForStoreQuery(): Promise<void> {
        const start = Date.now();
        while (queryCalls.length === 0) {
            if (Date.now() - start > 1000) {
                throw new Error('store query never fired');
            }
            await new Promise((r) => setTimeout(r, 5));
        }
    }

    async function respondToStoreQuery(event: DbPluginQueryEvent<any, unknown>, rows: unknown[]) {
        await waitForStoreQuery();
        expect(queryCalls).toHaveLength(1);
        // The store's result is read through queryResultToArray too, so it has to be a
        // real ITranslatedValue rather than a bare { value } object.
        queryCalls[0].callback(PluginEventResult.success(event.id, createTranslated(rows)));
    }

    function changesFromOnlyPersist(): SchemaChanges {
        expect(bulkPersistCalls).toHaveLength(1);
        return bulkPersistCalls[0].event.operation.get(testSchema.id);
    }

    it('classifies all rows as adds when store returns empty', async () => {
        const event = createEvent();
        const row1 = { id: 'a', name: 'Alice' };
        const row2 = { id: 'b', name: 'Bob' };

        const persisted = persistToStore(event, createTranslated([row1, row2]));
        await respondToStoreQuery(event, []);
        await persisted;

        expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
        expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
        const changes = changesFromOnlyPersist();
        expect(changes.adds).toHaveLength(2);
        expect(changes.adds).toEqual(expect.arrayContaining([row1, row2]));
        expect(changes.updates).toHaveLength(0);
    });

    it('classifies rows as adds or updates based on store result', async () => {
        const event = createEvent();
        const row1 = { id: 'a', name: 'Alice' };
        const row2 = { id: 'b', name: 'Bob' };

        const persisted = persistToStore(event, createTranslated([row1, row2]));
        await respondToStoreQuery(event, [{ id: 'a', name: 'Alice (cached)' }]);
        await persisted;

        expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
        const changes = changesFromOnlyPersist();
        expect(changes.adds).toHaveLength(1);
        expect(changes.adds[0]).toEqual(row2);
        expect(changes.updates).toHaveLength(1);
        expect((changes.updates[0] as { entity: unknown }).entity).toEqual(row1);
    });

    it('does not write to the store when there is nothing to persist', async () => {
        const event = createEvent();

        const persisted = persistToStore(event, createTranslated([]));
        await respondToStoreQuery(event, []);
        await persisted;

        expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
        // No adds, updates, or removes means no bulkPersist at all — an empty write would
        // still churn the store and notify subscribers for no change.
        expect(mockSwrStore.bulkPersist).not.toHaveBeenCalled();
    });

    it('passes single object value as one row', async () => {
        const event = createEvent();
        const row = { id: 'only', name: 'Solo' };

        const persisted = persistToStore(event, createTranslated(row));
        await respondToStoreQuery(event, []);
        await persisted;

        expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
        expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
        const changes = changesFromOnlyPersist();
        expect(changes.adds).toHaveLength(1);
        expect(changes.adds[0]).toEqual(row);
    });

    it('rejects and skips the store write when query-by-ids fails', async () => {
        const event = createEvent();
        const err = new Error('store query failed');

        const persisted = persistToStore(event, createTranslated([{ id: 'x', name: 'X' }]));
        await waitForStoreQuery();
        queryCalls[0].callback(PluginEventResult.error(event.id, err));

        await expect(persisted).rejects.toThrow('store query failed');
        expect(mockSwrStore.bulkPersist).not.toHaveBeenCalled();
    });

    it('when server data has changed (property updated), persists the update to the SWR store', async () => {
        const event = createEvent();
        const serverRow = { id: 'a', name: 'Alice Updated' };

        const persisted = persistToStore(event, createTranslated([serverRow]));
        await respondToStoreQuery(event, [{ id: 'a', name: 'Alice Old' }]);
        await persisted;

        expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
        const changes = changesFromOnlyPersist();
        expect(changes.adds).toHaveLength(0);
        expect(changes.updates).toHaveLength(1);
        expect((changes.updates[0] as { entity: unknown }).entity).toEqual(serverRow);
    });

    it('when store has same entity (schema.compare equal), does not add to updates', async () => {
        const event = createEvent();
        const serverRow = { id: 'a', name: 'Alice' };

        const persisted = persistToStore(event, createTranslated([serverRow]));
        await respondToStoreQuery(event, [{ id: 'a', name: 'Alice' }]);
        await persisted;

        // Identical entity classifies as neither add nor update, which leaves the
        // classification empty and skips the store write entirely.
        expect(mockSwrStore.bulkPersist).not.toHaveBeenCalled();
    });
});
