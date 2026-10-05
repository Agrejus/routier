import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OptimisticUpdatesDbPlugin } from './OptimisticUpdatesDbPlugin';
import type { DbPluginQueryEvent, DbPluginBulkPersistEvent, IDbPlugin } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { etags, s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { uuid } from '@routier/core/utilities';
import { ConcurrencyDbPlugin } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import type { OptimisticRequestError, SyncEvent } from './syncHooks';

/**
 * Integration tests with a real MemoryPlugin as the source. The optimistic plugin's own
 * read plugin is also a MemoryPlugin, so this exercises the real hydration, ack, and
 * mirror machinery end to end.
 */

const testSchema = s
    .define('optimisticIntegration', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

const otherSchema = s
    .define('optimisticIntegrationOther', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

function buildSchemas(): SchemaCollection {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    schemas.set(otherSchema.id, otherSchema as any);
    return schemas;
}

function createQueryEvent(schema = testSchema): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    return {
        id: uuid(8),
        schemas: buildSchemas(),
        source: 'test',
        action: 'query',
        explain: false,
        executedQueries: [],
        operation: Query.EMPTY(schema as any) as any,
    };
}

function createPersistEvent(changes: { adds?: unknown[]; removes?: unknown[] }, schema = testSchema): DbPluginBulkPersistEvent {
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve(schema.id);
    schemaChanges.adds = (changes.adds ?? []) as never[];
    schemaChanges.removes = (changes.removes ?? []) as never[];
    return {
        id: uuid(8),
        schemas: buildSchemas(),
        source: 'test',
        action: 'persist',
        operation,
    };
}

function queryRows(plugin: IDbPlugin, schema = testSchema): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        plugin.query(createQueryEvent(schema), (result) => {
            if (result.ok === Result.ERROR) {
                reject(result.error);
                return;
            }
            const rows: unknown[] = [];
            result.data.forEach((item: unknown) => rows.push(item));
            resolve(rows);
        });
    });
}

function persist(plugin: IDbPlugin, changes: { adds?: unknown[]; removes?: unknown[] }, schema = testSchema): Promise<unknown> {
    return new Promise((resolve, reject) => {
        plugin.bulkPersist(createPersistEvent(changes, schema), (result) => {
            if (result.ok === Result.ERROR) {
                reject(result.error);
                return;
            }
            resolve(result.data);
        });
    });
}

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
    const start = Date.now();
    while (!(await condition())) {
        if (Date.now() - start > timeoutMs) {
            throw new Error('condition never became true');
        }
        await new Promise((r) => setTimeout(r, 10));
    }
}

describe('OptimisticUpdatesDbPlugin integration', () => {
    let source: MemoryPlugin;
    let plugin: OptimisticUpdatesDbPlugin;

    beforeEach(() => {
        source = new MemoryPlugin(`optimistic-source-${uuid(8)}`);
        plugin = new OptimisticUpdatesDbPlugin(source);
    });

    it('hydrates from the source on first query and serves the source rows', async () => {
        await persist(source, { adds: [{ name: 'Seeded A' }, { name: 'Seeded B' }] });
        const sourceQuerySpy = jest.spyOn(source, 'query');

        const rows = await queryRows(plugin);

        expect(rows).toHaveLength(2);
        expect(sourceQuerySpy).toHaveBeenCalledTimes(1); // hydration query
    });

    it('stores the hydrated rows as a hydration that keeps their etags', async () => {
        await persist(source, { adds: [{ name: 'Seeded A' }] });
        const writes = jest.spyOn(MemoryPlugin.prototype, 'bulkPersist');

        await queryRows(plugin);

        expect(writes.mock.calls.map(([event]) => [event.source, event.action, event.reason, event.etags])).toEqual([['OptimisticReplicationDbPlugin', 'persist', 'hydration', 'keep']]);
        writes.mockRestore();
    });

    it('serves subsequent queries from the read plugin without re-querying the source', async () => {
        await persist(source, { adds: [{ name: 'Seeded' }] });
        const sourceQuerySpy = jest.spyOn(source, 'query');

        await queryRows(plugin);
        await queryRows(plugin);
        await queryRows(plugin);

        expect(sourceQuerySpy).toHaveBeenCalledTimes(1); // hydration only, once
    });

    it('acks writes from the read plugin and mirrors them to the source with resolved ids', async () => {
        const result = await persist(plugin, { adds: [{ name: 'Optimistic Add' }] }) as { get: (id: number) => { adds: Array<{ id: string }> } };

        // Ack carries the read plugin's resolved identity
        const acked = result.get(testSchema.id);
        expect(acked.adds).toHaveLength(1);
        expect(acked.adds[0].id).toBeTruthy();

        // Read path sees it immediately
        expect(await queryRows(plugin)).toHaveLength(1);

        // The mirror write lands on the source in the background, with the SAME id
        await waitFor(async () => (await queryRows(source)).length === 1);
        const sourceRows = await queryRows(source) as Array<{ id: string }>;
        expect(sourceRows[0].id).toBe(acked.adds[0].id);
    });

    it('does not resurrect removed entities by re-hydrating after a remove-all', async () => {
        await persist(source, { adds: [{ name: 'Doomed' }] });

        const [row] = await queryRows(plugin) as Array<Record<string, unknown>>;
        await persist(plugin, { removes: [row] });

        // The read plugin is empty AND this instance has written to the collection, so
        // an empty result is real data — not a missed hydration to retry against a
        // source whose mirrored remove may still be in flight.
        expect(await queryRows(plugin)).toHaveLength(0);
    });

    it('hydrates before a write so pre-existing source rows stay visible', async () => {
        await persist(source, { adds: [{ name: 'Pre-existing A' }, { name: 'Pre-existing B' }] });

        await persist(plugin, { adds: [{ name: 'New write' }] });

        const rows = await queryRows(plugin) as Array<{ name: string }>;
        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.name)).toEqual(
            expect.arrayContaining(['Pre-existing A', 'Pre-existing B', 'New write'])
        );
    });

    it('does not resurrect a row removed while hydration is in flight', async () => {
        await persist(source, { adds: [{ name: 'Doomed' }] });

        const slowResultSource: IDbPlugin = {
            get databaseName() { return source.databaseName; },
            query: (event, done) => source.query(event, (result) => { setTimeout(() => done(result), 50); }),
            bulkPersist: (event, done) => source.bulkPersist(event, done),
            destroy: (event, done) => source.destroy(event, done),
        };
        const slow = new OptimisticUpdatesDbPlugin(slowResultSource);

        const hydratingRead = queryRows(slow);
        const [doomed] = await queryRows(source) as Array<Record<string, unknown>>;
        await persist(slow, { removes: [doomed] });
        await hydratingRead;

        expect(await queryRows(slow)).toHaveLength(0);
    });

    it('fails the write when hydration fails instead of writing into an empty store', async () => {
        const failingSource: IDbPlugin = {
            databaseName: 'failing-source',
            query: (event, done) => done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any),
            bulkPersist: (event, done) => done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any),
            destroy: (_event, done) => done({ ok: Result.SUCCESS, id: '' } as any),
        };
        const failing = new OptimisticUpdatesDbPlugin(failingSource);

        await expect(persist(failing, { adds: [{ name: 'Lost' }] })).rejects.toThrow('source down');
    });

    it('hydrates collections independently', async () => {
        await persist(source, { adds: [{ name: 'A row' }] });
        await persist(source, { adds: [{ name: 'Other row' }] }, otherSchema);
        const sourceQuerySpy = jest.spyOn(source, 'query');

        expect(await queryRows(plugin)).toHaveLength(1);
        expect(sourceQuerySpy).toHaveBeenCalledTimes(1);

        expect(await queryRows(plugin, otherSchema)).toHaveLength(1);
        expect(sourceQuerySpy).toHaveBeenCalledTimes(2);
    });

    it('reports a mirror write the source refused, while still acking it', async () => {
        const events: SyncEvent[] = [];
        const flaky = flakySource(source, { writes: 1 });
        const withHook = new OptimisticUpdatesDbPlugin(flaky, { onEvent: event => events.push(event) });

        await persist(withHook, { adds: [{ name: 'Acked locally' }] });
        expect(await queryRows(withHook)).toHaveLength(1);

        await waitFor(async () => events.some(event => event.type === 'changes-rejected'));
        expect(events.find(event => event.type === 'changes-rejected')).toEqual({
            type: 'changes-rejected',
            collectionName: 'optimisticIntegration',
            changes: [{ kind: 'add', entity: expect.objectContaining({ name: 'Acked locally' }) }],
            conflict: false,
            status: null,
            error: expect.any(Error),
        });
    });
    it('surfaces hydration failure instead of serving an empty result', async () => {
        const failingSource: IDbPlugin = {
            databaseName: 'failing-source',
            query: (event, done) => done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any),
            bulkPersist: (event, done) => done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any),
            destroy: (_event, done) => done({ ok: Result.SUCCESS, id: '' } as any),
        };
        const failing = new OptimisticUpdatesDbPlugin(failingSource);

        await expect(queryRows(failing)).rejects.toThrow('source down');
        // And subsequent queries fail fast rather than serving a silently-empty store
        await expect(queryRows(failing)).rejects.toBeDefined();
    });
});

describe('OptimisticUpdatesDbPlugin etags', () => {
    const versionedSchema = s.define('optimisticVersioned', {
        id: s.string().key().identity(),
        name: s.string(),
        revision: s.string().etag(etags.lexical),
    }).compile();

    class VersionedStore extends DataStore {
        items = this.collection(versionedSchema).proxy().create();
    }

    const seededStore = async () => {
        const source = new MemoryPlugin(`optimistic-etag-${uuid(8)}`);
        source.seed(versionedSchema, [{ id: 'a', name: 'first', revision: 'seeded' }]);
        const store = new VersionedStore(new OptimisticUpdatesDbPlugin(source));
        const [hydrated] = await store.items.toArrayAsync();

        if (hydrated == null) {
            throw new Error('nothing hydrated');
        }

        return { source, store, hydrated };
    };

    it('keeps the source etag when it hydrates', async () => {
        const { hydrated } = await seededStore();

        expect(hydrated.revision).toBe('seeded');
    });

    it('lets the source generate the etag on an update', async () => {
        const { source, store, hydrated } = await seededStore();
        hydrated.name = 'second';
        await store.saveChangesAsync();

        const [durable] = await new VersionedStore(source).items.toArrayAsync();

        expect([durable?.name, durable?.revision === 'seeded']).toEqual(['second', false]);
    });

    it('takes the etag the source generated into its memory copy', async () => {
        const { source, store, hydrated } = await seededStore();
        hydrated.name = 'second';
        await store.saveChangesAsync();
        const durableRevision = async () => (await new VersionedStore(source).items.toArrayAsync())[0]?.revision;

        await waitFor(async () => (await store.items.toArrayAsync())[0]?.revision === await durableRevision());

        expect((await store.items.toArrayAsync())[0]?.revision).not.toBe('seeded');
    });

    it('gives a row it added the etag the source generated', async () => {
        const source = new MemoryPlugin(`optimistic-etag-${uuid(8)}`);
        const store = new VersionedStore(new OptimisticUpdatesDbPlugin(source));
        await store.items.addAsync({ name: 'new' });
        await store.saveChangesAsync();

        await waitFor(async () => (await store.items.toArrayAsync())[0]?.revision != null);

        const [cached] = await store.items.toArrayAsync();
        const [durable] = await new VersionedStore(source).items.toArrayAsync();
        expect(cached?.revision).toBe(durable?.revision);
    });

    it('refuses a save that ConcurrencyDbPlugin guards', async () => {
        const { source } = await seededStore();
        const store = new VersionedStore(new ConcurrencyDbPlugin(new OptimisticUpdatesDbPlugin(source)));
        const [row] = await store.items.toArrayAsync();

        if (row == null) {
            throw new Error('nothing stored');
        }

        row.name = 'guarded';

        await expect(store.saveChangesAsync()).rejects.toThrow(
            'OptimisticUpdatesDbPlugin cannot support optimistic concurrency, so ConcurrencyDbPlugin must not wrap it.  ' +
            'It acknowledges a save before the source has checked it, so a conflict could only be found after the caller was told the save succeeded.  ' +
            'Collection: optimisticVersioned'
        );
    });
});

function flakySource(inner: IDbPlugin, failures: { reads?: number; writes?: number }): IDbPlugin {
    let reads = failures.reads ?? 0;
    let writes = failures.writes ?? 0;

    return {
        databaseName: inner.databaseName,
        query: (event, done) => {
            if (reads > 0) {
                reads--;
                done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any);
                return;
            }
            inner.query(event, done);
        },
        bulkPersist: (event, done) => {
            if (writes > 0) {
                writes--;
                done({ ok: Result.ERROR, error: new Error('source down'), id: event.id } as any);
                return;
            }
            inner.bulkPersist(event, done);
        },
        destroy: (event, done) => inner.destroy(event, done),
    };
}

describe('OptimisticUpdatesDbPlugin hooks', () => {
    let source: MemoryPlugin;

    beforeEach(() => {
        source = new MemoryPlugin(`optimistic-hooks-${uuid(8)}`);
    });

    it('describes a failed mirror write as a store write with retry and reject', async () => {
        const seen: OptimisticRequestError[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { writes: 1 }), {
            onError: error => { seen.push(error); if (error.operation === 'write') error.reject(); },
        });

        await persist(plugin, { adds: [{ name: 'a' }] });
        await waitFor(async () => seen.length === 1);

        const [error] = seen;
        expect([error?.kind, error?.operation, error?.collectionName, error?.attempt, error?.method, error?.url])
            .toEqual(['store', 'write', 'optimisticIntegration', 1, null, null]);
    });

    it('saves a mirror write that onError retried, without reporting it', async () => {
        const events: SyncEvent[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { writes: 1 }), {
            onError: error => void error.retry(),
            onEvent: event => events.push(event),
        });

        await persist(plugin, { adds: [{ name: 'a' }] });

        await waitFor(async () => (await queryRows(source)).length === 1);
        expect(events.filter(event => event.type === 'changes-rejected')).toEqual([]);
    });

    it('reports a mirror write onError rejected', async () => {
        const events: SyncEvent[] = [];
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { writes: 1 }), {
            onError: error => { if (error.operation === 'write') error.reject(); },
            onEvent: event => events.push(event),
        });

        await persist(plugin, { adds: [{ name: 'a' }] });

        await waitFor(async () => events.some(event => event.type === 'changes-rejected'));
        expect(await queryRows(source)).toEqual([]);
    });

    it('reports a successful hydration', async () => {
        const events: SyncEvent[] = [];
        await persist(source, { adds: [{ name: 'a' }] });

        await queryRows(new OptimisticUpdatesDbPlugin(source, { onEvent: event => events.push(event) }));

        expect(events).toEqual([{ type: 'read', ok: true, collectionName: 'optimisticIntegration', status: null }]);
    });

    it('hydrates once onError retries a failed load', async () => {
        await persist(source, { adds: [{ name: 'a' }] });
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { reads: 1 }), { onError: error => void error.retry() });

        expect(await queryRows(plugin)).toHaveLength(1);
    });

    it('answers from the memory copy when onError chooses the cache', async () => {
        const events: SyncEvent[] = [];
        await persist(source, { adds: [{ name: 'a' }] });
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { reads: 1 }), {
            onError: error => { if (error.operation === 'read') error.useCached(); },
            onEvent: event => events.push(event),
        });

        expect(await queryRows(plugin)).toEqual([]);
        expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'optimisticIntegration', status: null, error: expect.any(Error) }]);
    });

    it('loads from the source again after answering from the cache', async () => {
        await persist(source, { adds: [{ name: 'a' }] });
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { reads: 1 }), {
            onError: error => { if (error.operation === 'read') error.useCached(); },
        });

        await queryRows(plugin);

        expect(await queryRows(plugin)).toHaveLength(1);
    });

    it('refuses a write while the memory copy holds only what was cached', async () => {
        const plugin = new OptimisticUpdatesDbPlugin(flakySource(source, { reads: 1 }), {
            onError: error => { if (error.operation === 'read') error.useCached(); },
        });

        await expect(persist(plugin, { adds: [{ name: 'a' }] })).rejects.toThrow('source down');
    });
});
