import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from '@routier/core/collections';
import { DbPluginBulkPersistEvent, DbPluginQueryEvent, ITranslatedValue } from '@routier/core/plugins';
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult } from '@routier/core/results';
import { etags, InferRoot, InferType, s } from '@routier/core/schema';
import { logger, uuid } from '@routier/core/utilities';
import { adoptEtags } from './adoptEtags';
import { queryPlugin, RecordingMemoryPlugin } from './__tests__/httpTestKit';

const versioned = s.define('adopt_versioned', {
    id: s.string().key(),
    name: s.string(),
    version: s.number().etag(etags.numeric).optional(),
}).compile();

const plain = s.define('adopt_plain', {
    id: s.string().key(),
    name: s.string(),
}).compile();

type VersionedRow = InferType<typeof versioned>;

class Store extends RecordingMemoryPlugin {
    readonly queries: { source: string, action: string, explain: boolean, executed: number }[] = [];
    failReads = false;
    failWrites = false;

    override query<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        this.queries.push({ source: event.source, action: event.action, explain: event.explain, executed: event.executedQueries.length });

        if (this.failReads) {
            done(PluginEventResult.error(event.id, new Error('read failed')));
            return;
        }

        super.query(event, done);
    }

    override bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        if (this.failWrites) {
            this.writes.push(event);
            done(PluginEventResult.error(event.id, new Error('write failed')));
            return;
        }

        super.bulkPersist(event, done);
    }
}

const event: DbPluginBulkPersistEvent = {
    id: 'mirror',
    schemas: new SchemaCollection().set(versioned.id, versioned).set(plain.id, plain),
    operation: new BulkPersistChanges(),
    source: 'test',
    action: 'persist',
};

const durable = (rows: { adds?: VersionedRow[], updates?: VersionedRow[] }) => {
    const result = new BulkPersistResult();
    const persisted = result.resolve<InferRoot<typeof versioned>>(versioned.id);
    persisted.adds.push(...(rows.adds ?? []));
    persisted.updates.push(...(rows.updates ?? []));
    return result;
};

const durablePlain = (rows: InferType<typeof plain>[]) => {
    const result = new BulkPersistResult();
    result.resolve<InferRoot<typeof plain>>(plain.id).updates.push(...rows);
    return result;
};

const storeWith = (rows: VersionedRow[]) => {
    const store = new Store(`adopt-${uuid(8)}`);
    store.seed(versioned, rows);
    return store;
};

const stored = (store: Store) => queryPlugin(store, versioned);

describe('adoptEtags', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('copies the durable etag of an updated row into the store', async () => {
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect(await stored(store)).toEqual([{ id: 'a', name: 'one', version: 2 }]);
    });

    it('copies the durable etag of an added row into the store', async () => {
        const store = storeWith([{ id: 'a', name: 'one' }]);

        await adoptEtags(store, event, durable({ adds: [{ id: 'a', name: 'one', version: 1 }] }));

        expect(await stored(store)).toEqual([{ id: 'a', name: 'one', version: 1 }]);
    });

    it('keeps a newer local edit and changes only the etag', async () => {
        const store = storeWith([{ id: 'a', name: 'newer', version: 1 }]);

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'older', version: 2 }] }));

        expect(await stored(store)).toEqual([{ id: 'a', name: 'newer', version: 2 }]);
    });

    it('writes with a keep-mode event that names itself', async () => {
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect(store.writes.map(write => [write.source, write.action, write.reason, write.etags])).toEqual([['OptimisticUpdatesDbPlugin', 'persist', 'adopt-etags', 'keep']]);
        expect(store.queries[0]).toEqual({ source: 'OptimisticUpdatesDbPlugin', action: 'query', explain: false, executed: 0 });
    });

    it.each([
        ['the etag already matches', [{ id: 'a', name: 'one', version: 2 }], { updates: [{ id: 'a', name: 'one', version: 2 }] }],
        ['the row is not in the store', [{ id: 'b', name: 'other', version: 1 }], { updates: [{ id: 'a', name: 'one', version: 2 }] }],
        ['the durable result holds no rows', [{ id: 'a', name: 'one', version: 1 }], {}],
    ])('writes nothing when %s', async (_, rows, result) => {
        const store = storeWith(rows);

        await adoptEtags(store, event, durable(result));

        expect(store.writes).toEqual([]);
    });

    it('does not read the store when the durable result holds no rows', async () => {
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);

        await adoptEtags(store, event, durable({}));

        expect(store.queries).toEqual([]);
    });

    it('skips a schema without an etag', async () => {
        const store = storeWith([]);

        await adoptEtags(store, event, durablePlain([{ id: 'a', name: 'one' }]));

        expect([store.queries, store.writes]).toEqual([[], []]);
    });

    it('skips a schema the event does not carry', async () => {
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);

        await adoptEtags(store, { ...event, schemas: new SchemaCollection() }, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect([store.queries, store.writes]).toEqual([[], []]);
    });

    it('logs a failed read and writes nothing', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);
        store.failReads = true;

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect(store.writes).toEqual([]);
        expect(warn).toHaveBeenCalledWith('[OptimisticUpdatesDbPlugin] could not adopt the source etags', { collectionName: 'adopt_versioned', error: new Error('read failed') });
    });

    it('logs a failed write', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);
        store.failWrites = true;

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect(warn).toHaveBeenCalledWith('[OptimisticUpdatesDbPlugin] could not adopt the source etags', { collectionName: 'adopt_versioned', error: expect.any(Error) });
    });

    it('does not log when it succeeds', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const store = storeWith([{ id: 'a', name: 'one', version: 1 }]);

        await adoptEtags(store, event, durable({ updates: [{ id: 'a', name: 'one', version: 2 }] }));

        expect(warn).not.toHaveBeenCalled();
    });
});
