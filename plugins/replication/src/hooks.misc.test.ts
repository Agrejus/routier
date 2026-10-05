import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import type { DbPluginBulkPersistEvent, DbPluginQueryEvent, IDbPlugin } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { PluginEventResult, Result } from '@routier/core/results';
import { s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';
import { HttpDbPlugin } from './HttpDbPlugin';
import { NetworkError, responseHeadersOf } from './httpUtils';
import { OptimisticUpdatesDbPlugin } from './OptimisticUpdatesDbPlugin';
import { PluginSyncEngine } from './PluginSyncEngine';
import type { HttpRequestError, OptimisticRequestError, SyncEvent } from './syncHooks';
import { UnsyncedQueue } from './UnsyncedQueue';
import { readQueueRows, writeQueueRows } from './__tests__/httpTestKit';

const mainSchema = s.define('miscMain', { id: s.string().key().identity(), name: s.string() }).compile();
const otherSchema = s.define('miscOther', { id: s.string().key().identity(), name: s.string() }).compile();

type Row = { id?: string; name: string };
type Buckets = { main?: { adds?: Row[]; updates?: Row[] }; other?: { adds?: Row[] } };

const schemas = (): SchemaCollection => {
    const collection = new SchemaCollection();
    collection.set(mainSchema.id, mainSchema as never);
    collection.set(otherSchema.id, otherSchema as never);
    return collection;
};

const queryEvent = (schema = mainSchema): DbPluginQueryEvent<Record<string, unknown>, unknown> => ({
    id: uuid(8),
    schemas: schemas(),
    source: 'test',
    action: 'query',
    explain: false,
    executedQueries: [],
    operation: Query.EMPTY(schema as never),
});

const persistEvent = (buckets: Buckets): DbPluginBulkPersistEvent => {
    const operation = new BulkPersistChanges();

    if (buckets.main != null) {
        const main = operation.resolve(mainSchema.id);
        main.adds = (buckets.main.adds ?? []) as never[];
        main.updates = (buckets.main.updates ?? []).map(entity => ({ entity, changeType: 'markedDirty', delta: {} })) as never[];
    }

    if (buckets.other != null) {
        operation.resolve(otherSchema.id).adds = (buckets.other.adds ?? []) as never[];
    }

    return { id: uuid(8), schemas: schemas(), source: 'test', action: 'persist', operation };
};

const query = (plugin: IDbPlugin, schema = mainSchema): Promise<Row[]> => new Promise((resolve, reject) => {
    plugin.query(queryEvent(schema), (result) => {
        if (result.ok === Result.ERROR) {
            reject(result.error);
            return;
        }

        const rows: Row[] = [];
        result.data.forEach(row => rows.push(row as Row));
        resolve(rows);
    });
});

const persist = (plugin: IDbPlugin, buckets: Buckets): Promise<void> => new Promise((resolve, reject) => {
    plugin.bulkPersist(persistEvent(buckets), (result) => (result.ok === Result.ERROR ? reject(result.error) : resolve()));
});

const until = async (condition: () => boolean): Promise<void> => {
    const start = Date.now();

    while (!condition()) {
        if (Date.now() - start > 2000) {
            throw new Error('condition never became true');
        }

        await new Promise(resolve => setTimeout(resolve, 5));
    }
};

const sourceAnswering = (inner: IDbPlugin, value: object): IDbPlugin => ({
    databaseName: inner.databaseName,
    query: (event, done) => done(PluginEventResult.success(event.id, { value, isEmpty: false, forEach: () => undefined } as never)),
    bulkPersist: (event, done) => inner.bulkPersist(event, done),
    destroy: (event, done) => inner.destroy(event, done),
});

const failingSource = (inner: IDbPlugin, fails: { readsOf?: string; writes?: number }): IDbPlugin => {
    let writes = fails.writes ?? 0;

    return {
        databaseName: inner.databaseName,
        query: (event, done) => {
            if (event.operation.schema.collectionName === fails.readsOf) {
                done(PluginEventResult.error(event.id, new Error('read down')));
                return;
            }

            inner.query(event, done);
        },
        bulkPersist: (event, done) => {
            if (writes > 0) {
                writes--;
                done(PluginEventResult.error(event.id, new Error('write down')));
                return;
            }

            inner.bulkPersist(event, done);
        },
        destroy: (event, done) => inner.destroy(event, done),
    };
};

class BrokenReadStore extends OptimisticUpdatesDbPlugin {
    constructor(source: IDbPlugin) {
        super(source);
        this.plugins = {
            source,
            read: {
                databaseName: 'broken-read',
                query: (event, done) => done(PluginEventResult.error(event.id, new Error('unused'))),
                bulkPersist: (event, done) => done(PluginEventResult.error(event.id, new Error('read store full'))),
                destroy: (event, done) => done(PluginEventResult.success(event.id)),
            },
        };
    }
}

describe('OptimisticUpdatesDbPlugin hydration edges', () => {
    it('refuses a hydration whose result is not an array', async () => {
        const plugin = new OptimisticUpdatesDbPlugin(sourceAnswering(new MemoryPlugin(`misc-${uuid(8)}`), { not: 'rows' }));

        await expect(query(plugin)).rejects.toThrow('Hydration query result is not an array');
    });

    it('hydrates only the rows that are objects', async () => {
        const plugin = new OptimisticUpdatesDbPlugin(sourceAnswering(new MemoryPlugin(`misc-${uuid(8)}`), [null, 5, 'x', { id: 'kept', name: 'Kept' }]));

        expect(await query(plugin)).toEqual([{ id: 'kept', name: 'Kept' }]);
    });

    it('fails the read when the memory copy cannot store the hydrated rows', async () => {
        await expect(query(new BrokenReadStore(new MemoryPlugin(`misc-${uuid(8)}`)))).rejects.toThrow('read store full');
    });

    it('refuses a write when any collection it touches could only answer from the cache', async () => {
        const plugin = new OptimisticUpdatesDbPlugin(failingSource(new MemoryPlugin(`misc-${uuid(8)}`), { readsOf: 'miscOther' }), {
            onError: error => { if (error.operation === 'read') error.useCached(); },
        });

        await expect(persist(plugin, { main: { adds: [{ name: 'a' }] }, other: { adds: [{ name: 'b' }] } })).rejects.toThrow('read down');
    });
});

describe('OptimisticUpdatesDbPlugin mirror failures', () => {
    it('names every collection a failed mirror write touched', async () => {
        const seen: OptimisticRequestError[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(failingSource(new MemoryPlugin(`misc-${uuid(8)}`), { writes: 1 }), {
            onError: error => { seen.push(error); if (error.operation === 'write') error.reject(); },
        });

        await persist(plugin, { main: { adds: [{ name: 'a' }] }, other: { adds: [{ name: 'b' }] } });
        await until(() => seen.length === 1);

        expect(seen[0]?.collectionName).toBe('miscMain, miscOther');
    });

    it('asks again with the next attempt when a retried mirror write fails again', async () => {
        const attempts: number[] = [];
        const events: SyncEvent[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(failingSource(new MemoryPlugin(`misc-${uuid(8)}`), { writes: 2 }), {
            onError: error => {
                attempts.push(error.attempt);
                if (error.operation === 'read') {
                    return;
                }
                if (error.attempt === 1) {
                    void error.retry();
                    return;
                }
                error.reject();
            },
            onEvent: event => events.push(event),
        });

        await persist(plugin, { main: { adds: [{ name: 'a' }] } });
        await until(() => events.some(event => event.type === 'changes-rejected'));

        expect(attempts).toEqual([1, 2]);
    });

    it('reports a rejected update with the entity it carried', async () => {
        const source = new MemoryPlugin(`misc-${uuid(8)}`);
        await persist(source, { main: { adds: [{ id: 'u1', name: 'Before' }] } });
        const events: SyncEvent[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(failingSource(source, { writes: 1 }), { onEvent: event => events.push(event) });
        await query(plugin);

        await persist(plugin, { main: { updates: [{ id: 'u1', name: 'After' }] } });
        await until(() => events.some(event => event.type === 'changes-rejected'));

        expect(events.find(event => event.type === 'changes-rejected')).toEqual(expect.objectContaining({
            collectionName: 'miscMain',
            changes: [{ kind: 'update', entity: { id: 'u1', name: 'After' } }],
        }));
    });

    it('leaves a collection with an empty bucket out of the rejection', async () => {
        const seen: OptimisticRequestError[] = [];
        const events: SyncEvent[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(failingSource(new MemoryPlugin(`misc-${uuid(8)}`), { writes: 1 }), {
            onError: error => { seen.push(error); if (error.operation === 'write') error.reject(); },
            onEvent: event => events.push(event),
        });

        await persist(plugin, { main: {}, other: { adds: [{ name: 'b' }] } });
        await until(() => events.some(event => event.type === 'changes-rejected'));

        expect([seen[0]?.collectionName, events.filter(event => event.type === 'changes-rejected').map(event => event.type === 'changes-rejected' && event.collectionName)])
            .toEqual(['miscOther', ['miscOther']]);
    });
});

describe('PluginSyncEngine mirror reports', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    const failingAfterPersist = (onMirrorError?: (error: Error, context: { plugin: IDbPlugin; eventId: string; event: DbPluginBulkPersistEvent }) => void) => {
        const mirror = new MemoryPlugin(`misc-mirror-${uuid(8)}`);
        const engine = new PluginSyncEngine({
            source: new MemoryPlugin(`misc-source-${uuid(8)}`),
            mirrorPlugins: [mirror],
            persistAckMode: 'after-all',
            mirrorFailureMode: 'swallow',
            onMirrorPersisted: () => {
                throw new Error('after persist');
            },
            ...(onMirrorError == null ? {} : { onMirrorError }),
        });
        return { mirror, engine };
    };

    it('reports a mirror whose follow-up threw, with the event it was sent', async () => {
        const reports: Array<[Error, { plugin: IDbPlugin; eventId: string; event: DbPluginBulkPersistEvent }]> = [];
        const { mirror, engine } = failingAfterPersist((error, context) => reports.push([error, context]));
        const sent = jest.spyOn(mirror, 'bulkPersist');
        const event = persistEvent({ main: { adds: [{ name: 'a' }] } });

        await new Promise<void>(resolve => engine.bulkPersist(event, () => resolve()));

        expect(reports).toEqual([[new Error('after persist'), { plugin: mirror, eventId: event.id, event: sent.mock.calls[0]?.[0] }]]);
    });

    it('logs which database a mirror failed on', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const { mirror, engine } = failingAfterPersist(() => undefined);
        const event = persistEvent({ main: { adds: [{ name: 'a' }] } });

        await new Promise<void>(resolve => engine.bulkPersist(event, () => resolve()));

        expect(warn).toHaveBeenCalledWith('[PluginSyncEngine] mirror persist failed', { databaseName: mirror.databaseName, eventId: event.id, error: new Error('after persist') });
    });

    it('reports a mirror failure quietly when nothing listens for it', async () => {
        const error = jest.spyOn(logger, 'error');
        const { engine } = failingAfterPersist();

        await new Promise<void>(resolve => engine.bulkPersist(persistEvent({ main: { adds: [{ name: 'a' }] } }), () => resolve()));

        expect(error).not.toHaveBeenCalled();
    });
});

describe('UnsyncedQueue revisions', () => {
    const queued = async (revision?: string) => {
        const store = new MemoryPlugin(`misc-queue-${uuid(8)}`);
        await writeQueueRows(store, [{
            id: ['misc', 'add', '["r"]'].join('\u0000'),
            collectionName: 'misc',
            recordIds: '["r"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'r', name: 'R' }),
            status: 'pending',
            ...(revision == null ? {} : { revision }),
        }]);
        const [row] = await readQueueRows(store);
        return { store, queue: new UnsyncedQueue(store), row };
    };

    it('dead-letters a row when the copy that was sent has no revision', async () => {
        const { queue, row } = await queued('current');

        const dead = await queue.deadLetter([{ ...row, revision: undefined }] as never);

        expect(dead.map(deadRow => deadRow.revision)).toEqual(['current']);
    });

    it('dead-letters a row that has no revision of its own', async () => {
        const { queue, row } = await queued();

        const dead = await queue.deadLetter([{ ...row, revision: 'sent' }] as never);

        expect(dead).toHaveLength(1);
    });

    it('counts a failed attempt on a row that has no revision of its own', async () => {
        const { store, queue, row } = await queued();

        await queue.recordFailedAttempt([{ ...row, revision: 'sent' }] as never);

        expect((await readQueueRows(store))[0]?.attempts).toBe(1);
    });

    it('skips a row whose revision changed since it was sent', async () => {
        const { queue, row } = await queued('current');

        expect(await queue.deadLetter([{ ...row, revision: 'older' }] as never)).toEqual([]);
    });
});

describe('HTTP helpers', () => {
    it('answers null for every header of a response without headers', () => {
        expect(responseHeadersOf({}).get('ETag')).toBeNull();
    });

    it('keeps what a network failure was caused by', () => {
        const cause = new Error('offline');

        expect(new NetworkError(cause).cause).toBe(cause);
    });
});

describe('HttpDbPlugin failures that are not requests', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const failingHeaders = () => {
        const seen: HttpRequestError[] = [];
        const plugin = new HttpDbPlugin({
            getUrl: collection => `https://api.test/${collection}`,
            getHeaders: () => {
                throw new Error('no token');
            },
            onError: error => { seen.push(error); error.done(); },
        });
        return { plugin, seen };
    };

    it('fails a read without asking onError when the headers cannot be built', async () => {
        const { plugin, seen } = failingHeaders();

        await expect(query(plugin)).rejects.toThrow('no token');
        expect(seen).toEqual([]);
    });

    it('fails a write without asking onError when the headers cannot be built', async () => {
        const { plugin, seen } = failingHeaders();

        await expect(persist(plugin, { main: { adds: [{ id: 'a', name: 'a' }] } })).rejects.toThrow('no token');
        expect(seen).toEqual([]);
    });

    it('reports no body for an error response whose body cannot be read', async () => {
        const response = new Response(null, { status: 500, statusText: 'broken' });
        response.text = () => Promise.reject(new Error('stream broke'));
        global.fetch = jest.fn<typeof fetch>(() => Promise.resolve(response));
        const seen: HttpRequestError[] = [];
        const plugin = new HttpDbPlugin({
            getUrl: collection => `https://api.test/${collection}`,
            onError: error => { seen.push(error); error.done(); },
        });

        await expect(query(plugin)).rejects.toThrow('HTTP 500');
        expect(seen.map(error => (error.kind === 'http' ? error.body : 'not http'))).toEqual([null]);
    });
});
