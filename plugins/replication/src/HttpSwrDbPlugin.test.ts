import { describe, it, expect, beforeEach } from '@jest/globals';
import { HttpSwrDbPlugin } from './HttpSwrDbPlugin';
import type { IDbPlugin } from '@routier/core/plugins';
import type { DbPluginQueryEvent } from '@routier/core/plugins';
import type { ITranslatedValue } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { PluginEventResult, Result } from '@routier/core/results';
import { SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';

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
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

function createTranslated<T>(value: T): ITranslatedValue<T> {
    return {
        value,
        forEach: (_cb: (item: unknown) => unknown) => { },
    } as ITranslatedValue<T>;
}

describe('HttpSwrDbPlugin persistToStore', () => {
    let mockSwrStore: IDbPlugin;
    let plugin: HttpSwrDbPlugin;
    let queryCalls: Array<{ event: DbPluginQueryEvent<any, unknown>; callback: (r: unknown) => void }>;
    let bulkPersistCalls: Array<{
        event: { operation: { get: (id: number) => { adds: unknown[]; updates: unknown[] } } };
        callback: (r: unknown) => void;
    }>;

    beforeEach(() => {
        queryCalls = [];
        bulkPersistCalls = [];
        mockSwrStore = {
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
        });
    });

    it('classifies all rows as adds when store returns empty', (done) => {
        const event = createEvent();
        const row1 = { id: 'a', name: 'Alice' };
        const row2 = { id: 'b', name: 'Bob' };
        const translated = createTranslated([row1, row2]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const bulkEvent = bulkPersistCalls[0].event;
            const schemaChanges = bulkEvent.operation.get(testSchema.id);
            expect(schemaChanges.adds).toHaveLength(2);
            expect(schemaChanges.adds).toEqual(expect.arrayContaining([row1, row2]));
            expect(schemaChanges.updates).toHaveLength(0);
            done();
        });

        setImmediate(() => {
            expect(queryCalls).toHaveLength(1);
            queryCalls[0].callback(PluginEventResult.success(event.id, { value: [] }));
        });
    });

    it('classifies rows as adds or updates based on store result', (done) => {
        const event = createEvent();
        const row1 = { id: 'a', name: 'Alice' };
        const row2 = { id: 'b', name: 'Bob' };
        const translated = createTranslated([row1, row2]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const bulkEvent = bulkPersistCalls[0].event;
            const schemaChanges = bulkEvent.operation.get(testSchema.id);
            expect(schemaChanges.adds).toHaveLength(1);
            expect(schemaChanges.adds[0]).toEqual(row2);
            expect(schemaChanges.updates).toHaveLength(1);
            expect((schemaChanges.updates[0] as { entity: unknown }).entity).toEqual(row1);
            done();
        });

        setImmediate(() => {
            queryCalls[0].callback(
                PluginEventResult.success(event.id, { value: [{ id: 'a', name: 'Alice (cached)' }] })
            );
        });
    });

    it('calls applyBulkPersist with empty adds and updates when rows is empty', (done) => {
        const event = createEvent();
        const translated = createTranslated([]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const bulkEvent = bulkPersistCalls[0].event;
            const schemaChanges = bulkEvent.operation.get(testSchema.id) as { adds: unknown[]; updates: unknown[]; removes: unknown[] };
            expect(schemaChanges.adds).toHaveLength(0);
            expect(schemaChanges.updates).toHaveLength(0);
            expect(schemaChanges.removes).toHaveLength(0);
            done();
        });

        setImmediate(() => {
            queryCalls[0].callback(PluginEventResult.success(event.id, { value: [] }));
        });
    });

    it('passes single object value as one row', (done) => {
        const event = createEvent();
        const row = { id: 'only', name: 'Solo' };
        const translated = createTranslated(row);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.query).toHaveBeenCalledTimes(1);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const schemaChanges = bulkPersistCalls[0].event.operation.get(testSchema.id);
            expect(schemaChanges.adds).toHaveLength(1);
            expect(schemaChanges.adds[0]).toEqual(row);
            done();
        });

        setImmediate(() => {
            queryCalls[0].callback(PluginEventResult.success(event.id, { value: [] }));
        });
    });

    it('reports error when query-by-ids fails', (done) => {
        const event = createEvent();
        const translated = createTranslated([{ id: 'x', name: 'X' }]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.ERROR);
            expect(mockSwrStore.bulkPersist).not.toHaveBeenCalled();
            done();
        });

        setImmediate(() => {
            const err = new Error('store query failed');
            queryCalls[0].callback(PluginEventResult.error(event.id, err));
        });
    });

    it('when server data has changed (property updated), persists update to SWR store and returns updated value', (done) => {
        const event = createEvent();
        const serverRow = { id: 'a', name: 'Alice Updated' };
        const translated = createTranslated([serverRow]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const bulkEvent = bulkPersistCalls[0].event;
            const schemaChanges = bulkEvent.operation.get(testSchema.id);
            expect(schemaChanges.adds).toHaveLength(0);
            expect(schemaChanges.updates).toHaveLength(1);
            expect((schemaChanges.updates[0] as { entity: unknown }).entity).toEqual(serverRow);
            const successResult = result as { ok: string; data: ITranslatedValue<unknown> };
            expect(successResult.data.value).toEqual([serverRow]);
            done();
        });

        setImmediate(() => {
            queryCalls[0].callback(
                PluginEventResult.success(event.id, { value: [{ id: 'a', name: 'Alice Old' }] })
            );
        });
    });

    it('when store has same entity (schema.compare equal), does not add to updates', (done) => {
        const event = createEvent();
        const serverRow = { id: 'a', name: 'Alice' };
        const translated = createTranslated([serverRow]);

        (plugin as any).persistToStore(event, translated, (result: unknown) => {
            expect((result as { ok: string }).ok).toBe(Result.SUCCESS);
            expect(mockSwrStore.bulkPersist).toHaveBeenCalledTimes(1);
            const bulkEvent = bulkPersistCalls[0].event;
            const schemaChanges = bulkEvent.operation.get(testSchema.id);
            expect(schemaChanges.adds).toHaveLength(0);
            expect(schemaChanges.updates).toHaveLength(0);
            done();
        });

        setImmediate(() => {
            queryCalls[0].callback(
                PluginEventResult.success(event.id, { value: [{ id: 'a', name: 'Alice' }] })
            );
        });
    });
});
