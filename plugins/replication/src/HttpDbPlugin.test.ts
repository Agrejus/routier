import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HttpDbPlugin } from './HttpDbPlugin';
import { createRetry } from './retry';
import type { HttpRequestError, SyncEvent } from './syncHooks';
import type { DbPluginQueryEvent, DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { Query, QueryOptionsCollection } from '@routier/core/plugins';
import { toExpression } from '@routier/core/expressions';
import { Result } from '@routier/core/results';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';

const testSchema = s
    .define('httpPlugin', {
        id: s.string().key().identity(),
        name: s.string(),
    })
    .compile();

function installFetchMock(responses: Array<{ status: number; body?: unknown }>) {
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
    let index = 0;
    global.fetch = jest.fn(async (url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
        calls.push({
            url: String(url),
            method: init?.method ?? 'GET',
            headers: init?.headers ?? {},
            body: init?.body != null ? JSON.parse(init.body) : undefined,
        });
        const response = responses[Math.min(index++, responses.length - 1)];
        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: `status-${response.status}`,
            json: async () => response.body ?? {},
        };
    }) as unknown as typeof fetch;
    return calls;
}

function createQueryEvent(): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return {
        id: uuid(8),
        schemas,
        source: 'test',
        action: 'query',
        explain: false,
        executedQueries: [],
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

function createPersistEvent(adds: unknown[]): DbPluginBulkPersistEvent {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    const operation = new BulkPersistChanges();
    operation.resolve(testSchema.id).adds = adds as never[];
    return {
        id: uuid(8),
        schemas,
        source: 'test',
        action: 'persist',
        operation,
    };
}

describe('HttpDbPlugin', () => {
    let plugin: HttpDbPlugin;

    beforeEach(() => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            getHeaders: () => ({ Authorization: 'Bearer token-123' }),
        });
    });

    it('GETs the collection URL with headers and returns translated rows', (done) => {
        const calls = installFetchMock([{ status: 200, body: [{ id: 'a', name: 'Alice' }] }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                const rows: unknown[] = [];
                result.data.forEach((item: unknown) => rows.push(item));
                expect(rows).toEqual([{ id: 'a', name: 'Alice' }]);
            }
            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe('https://api.test/httpPlugin');
            expect(calls[0].method).toBe('GET');
            expect(calls[0].headers).toEqual(expect.objectContaining({ Authorization: 'Bearer token-123' }));
            done();
        });
    });

    it('reports the GET it executed, once, and only on success', (done) => {
        installFetchMock([{ status: 200, body: [] }]);
        const event = createQueryEvent();

        plugin.query(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            expect(event.executedQueries).toEqual([{ text: 'GET https://api.test/httpPlugin' }]);
            done();
        });
    });

    it('reports nothing for a failed query', (done) => {
        installFetchMock([{ status: 500 }]);
        const event = createQueryEvent();

        plugin.query(event, (result) => {
            expect(result.ok).toBe(Result.ERROR);
            expect(event.executedQueries).toHaveLength(0);
            done();
        });
    });

    it('sends a failed query once when there is no onError', (done) => {
        const calls = installFetchMock([{ status: 500 }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.ERROR);
            expect(calls).toHaveLength(1);
            done();
        });
    });

    it('sends a failed query again when onError retries', (done) => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            onError: (error) => void error.retry(),
        });
        const calls = installFetchMock([{ status: 500 }, { status: 200, body: [] }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            expect(calls).toHaveLength(2);
            done();
        });
    });

    it('does not retry a 401 with createRetry', (done) => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            onError: createRetry({ baseDelayMs: 1, maxAttempts: 5 }),
        });
        const calls = installFetchMock([{ status: 401 }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.ERROR);
            expect(calls).toHaveLength(1);
            done();
        });
    });

    it('applies translateRemoteResponse to the fetched body', (done) => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            translateRemoteResponse: (_schema, data) => (data as { items: unknown[] }).items,
        });
        installFetchMock([{ status: 200, body: { items: [{ id: 'x', name: 'Wrapped' }] } }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                const rows: unknown[] = [];
                result.data.forEach((item: unknown) => rows.push(item));
                expect(rows).toEqual([{ id: 'x', name: 'Wrapped' }]);
            }
            done();
        });
    });

    /**
     * The server is sent in-memory names and the translator re-runs the lambdas over rows as the
     * server returns them, so neither can carry a renamed property. The datastore finishes it.
     */
    it('does not send an option over a renamed property, or anything after it', (done) => {
        const renamed = s.define('httpRenamed', {
            id: s.string().key().identity(),
            label: s.string().from('wire_label'),
        }).compile();
        const calls = installFetchMock([{ status: 200, body: [{ id: 'a', wire_label: 'x' }, { id: 'b', wire_label: 'y' }] }]);

        const filter = (x: any) => x.label === 'x';
        const options = new QueryOptionsCollection<any>();
        options.add('filter', { filter, expression: toExpression(renamed as never, filter), params: undefined } as never);
        options.add('take', 1);

        const schemas = new SchemaCollection();
        schemas.set(renamed.id, renamed as any);

        const event = {
            id: uuid(8),
            schemas,
            source: 'test',
            action: 'query',
            explain: false,
            executedQueries: [],
            operation: new Query(options, renamed as any),
        } as unknown as DbPluginQueryEvent<Record<string, unknown>, unknown>;

        plugin.query(event, (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                const rows: unknown[] = [];
                result.data.forEach((item: unknown) => rows.push(item));
                expect(rows).toHaveLength(2);
            }
            expect(calls[0].url).toBe('https://api.test/httpRenamed');
            expect(options.notExecuted().map(item => item.option.reason)).toEqual(['missing-capability', 'not-reached']);
            done();
        });
    });

    /**
     * A response is JSON, so a date arrives as a string, and the options this plugin runs itself
     * compare Dates. Keys stay as the server sent them: the datastore deserializes the rows.
     */
    it('compares dates in a response as Dates, and keeps renamed keys', (done) => {
        const dated = s.define('httpDated', {
            id: s.string().key().identity(),
            label: s.string().from('wire_label'),
            createdDate: s.date(),
        }).compile();
        installFetchMock([{
            status: 200,
            body: [
                { id: 'a', wire_label: 'old', createdDate: '2020-01-01T00:00:00.000Z' },
                { id: 'b', wire_label: 'new', createdDate: '2025-01-01T00:00:00.000Z' },
            ],
        }]);

        const filter = ([x, p]: [any, { d: Date }]) => x.createdDate > p.d;
        const params = { d: new Date('2024-01-01T00:00:00.000Z') };
        const options = new QueryOptionsCollection<any>();
        options.add('filter', { filter, expression: toExpression(dated as never, filter as never, params), params } as never);

        const schemas = new SchemaCollection();
        schemas.set(dated.id, dated as any);

        const event = {
            id: uuid(8),
            schemas,
            source: 'test',
            action: 'query',
            explain: false,
            executedQueries: [],
            operation: new Query(options, dated as any),
        } as unknown as DbPluginQueryEvent<Record<string, unknown>, unknown>;

        plugin.query(event, (result) => {
            if (result.ok !== Result.SUCCESS) {
                done(result.error);
                return;
            }
            {
                const rows: Record<string, unknown>[] = [];
                result.data.forEach((item: unknown) => rows.push(item as Record<string, unknown>));
                expect(rows.map(row => row.wire_label)).toEqual(['new']);
                expect(rows[0].createdDate).toEqual(new Date('2025-01-01T00:00:00.000Z'));
            }
            done();
        });
    });

    it('POSTs adds/updates/removes and reports them in the result', (done) => {
        const calls = installFetchMock([{ status: 200, body: {} }]);
        const entity = { id: 'n1', name: 'New' };

        plugin.bulkPersist(createPersistEvent([entity]), (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            if (result.ok === Result.SUCCESS) {
                expect(result.data.get(testSchema.id).adds).toEqual([entity]);
            }
            expect(calls).toHaveLength(1);
            expect(calls[0].method).toBe('POST');
            expect(calls[0].body).toEqual({ adds: [entity], updates: [], removes: [] });
            done();
        });
    });

    it('batches concurrent writes to the same URL into one POST', async () => {
        const calls = installFetchMock([{ status: 200, body: {} }]);
        const persist = (entity: { id: string; name: string }) => new Promise<void>((resolve, reject) => {
            plugin.bulkPersist(createPersistEvent([entity]), (result) => {
                if (result.ok === Result.ERROR) reject(result.error);
                else resolve();
            });
        });

        await Promise.all(Array.from({ length: 10 }, (_, i) =>
            persist({ id: `burst-${i}`, name: `Item ${i}` })
        ));

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toEqual({
            adds: Array.from({ length: 10 }, (_, i) => ({ id: `burst-${i}`, name: `Item ${i}` })),
            updates: [],
            removes: [],
        });
    });

    it('keeps different endpoint URLs in separate batches', async () => {
        const calls = installFetchMock([{ status: 200, body: {} }]);

        await Promise.all([
            plugin.postJson('https://api.test/first', JSON.stringify({ adds: [{ id: 'a' }], updates: [], removes: [] }), 'same-name'),
            plugin.postJson('https://api.test/second', JSON.stringify({ adds: [{ id: 'b' }], updates: [], removes: [] }), 'same-name'),
        ]);

        expect(calls.map((call) => call.url).sort()).toEqual([
            'https://api.test/first',
            'https://api.test/second',
        ]);
    });

    it('deduplicates an idempotent operation that enters the same batch twice', async () => {
        const calls = installFetchMock([{ status: 200, body: {} }]);
        const body = JSON.stringify({
            adds: [{ id: 'once' }],
            updates: [],
            removes: [],
            meta: { opIds: { adds: ['op-once'], updates: [], removes: [] } },
        });

        await Promise.all([
            plugin.postJson('https://api.test/httpPlugin', body, 'httpPlugin'),
            plugin.postJson('https://api.test/httpPlugin', body, 'httpPlugin'),
        ]);

        expect(calls).toHaveLength(1);
        expect(calls[0].body).toEqual({
            adds: [{ id: 'once' }],
            updates: [],
            removes: [],
            meta: { opIds: { adds: ['op-once'], updates: [], removes: [] } },
        });
    });

    it('surfaces a POST failure as an error result', (done) => {
        installFetchMock([{ status: 500 }]);

        plugin.bulkPersist(createPersistEvent([{ name: 'Doomed' }]), (result) => {
            expect(result.ok).toBe(Result.ERROR);
            done();
        });
    });
});

describe('HttpDbPlugin hooks', () => {
    const open = (hooks: { onError?: (error: HttpRequestError) => void; onEvent?: (event: SyncEvent) => void }) =>
        new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, writeBatchDelayMs: 0, minRequestIntervalMs: 0, ...hooks });

    const read = (plugin: HttpDbPlugin) => new Promise<{ ok: string; error?: Error }>((resolve) => {
        plugin.query(createQueryEvent(), (result) => resolve(result.ok === Result.ERROR ? { ok: result.ok, error: result.error } : { ok: result.ok }));
    });

    const write = (plugin: HttpDbPlugin, adds: unknown[]) => new Promise<{ ok: string; error?: Error }>((resolve) => {
        plugin.bulkPersist(createPersistEvent(adds), (result) => resolve(result.ok === Result.ERROR ? { ok: result.ok, error: result.error } : { ok: result.ok }));
    });

    it('reports a successful read', async () => {
        const events: SyncEvent[] = [];
        installFetchMock([{ status: 200, body: [] }]);

        await read(open({ onEvent: event => events.push(event) }));

        expect(events).toEqual([{ type: 'read', ok: true, collectionName: 'httpPlugin', status: 200 }]);
    });

    it('reports a failed read with its status', async () => {
        const events: SyncEvent[] = [];
        installFetchMock([{ status: 503 }]);

        await read(open({ onEvent: event => events.push(event) }));

        expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'httpPlugin', status: 503, error: expect.any(Error) }]);
    });

    it('describes a failed read to onError', async () => {
        const seen: HttpRequestError[] = [];
        installFetchMock([{ status: 503, body: { reason: 'maintenance' } }]);

        await read(open({ onError: error => { seen.push(error); error.done(); } }));

        const [error] = seen;
        expect(error?.kind === 'http' ? [error.status, error.body, error.operation, error.method, error.url, error.attempt] : null)
            .toEqual([503, { reason: 'maintenance' }, 'read', 'GET', 'https://api.test/httpPlugin', 1]);
    });

    it('fails the read with the error when onError calls done', async () => {
        installFetchMock([{ status: 503 }]);

        const result = await read(open({ onError: error => error.done() }));

        expect([result.ok, result.error?.message]).toEqual([Result.ERROR, 'HTTP 503: status-503']);
    });

    it('waits for onError to decide before the read finishes', async () => {
        let decide: (() => void) | undefined;
        installFetchMock([{ status: 503 }, { status: 200, body: [] }]);

        const pending = read(open({ onError: error => { decide = () => void error.retry(); } }));
        await new Promise(resolve => setTimeout(resolve, 10));
        decide?.();

        expect((await pending).ok).toBe(Result.SUCCESS);
    });

    it('describes a request that got no response as network', async () => {
        const kinds: string[] = [];
        global.fetch = jest.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;

        await read(open({ onError: error => { kinds.push(error.kind); error.done(); } }));

        expect(kinds).toEqual(['network']);
    });

    it('fetches the headers again for a retried request', async () => {
        let token = 'old';
        const calls = installFetchMock([{ status: 401 }, { status: 200, body: [] }]);
        const plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            getHeaders: () => ({ Authorization: token }),
            onError: (error) => {
                token = 'new';
                void error.retry();
            },
        });

        await read(plugin);

        expect(calls.map(call => call.headers.Authorization)).toEqual(['old', 'new']);
    });

    it('reports changes a failed write did not save, then fails the save', async () => {
        const events: SyncEvent[] = [];
        installFetchMock([{ status: 409 }]);

        const result = await write(open({ onEvent: event => events.push(event) }), [{ name: 'a' }]);

        expect(result.ok).toBe(Result.ERROR);
        expect(events).toEqual([{
            type: 'changes-rejected',
            collectionName: 'httpPlugin',
            changes: [{ kind: 'add', entity: { name: 'a' } }],
            conflict: true,
            status: 409,
            error: expect.any(Error),
        }]);
    });

    it('does not report a conflict for a refusal that is not 409', async () => {
        const conflicts: boolean[] = [];
        installFetchMock([{ status: 422 }]);

        await write(open({ onEvent: event => { if (event.type === 'changes-rejected') conflicts.push(event.conflict); } }), [{ name: 'a' }]);

        expect(conflicts).toEqual([false]);
    });

    it('saves a write that onError retried', async () => {
        const events: SyncEvent[] = [];
        const calls = installFetchMock([{ status: 503 }, { status: 200 }]);

        const result = await write(open({ onError: error => void error.retry(), onEvent: event => events.push(event) }), [{ name: 'a' }]);

        expect([result.ok, calls.length, events]).toEqual([Result.SUCCESS, 2, []]);
    });

    it('describes a failed write as a write', async () => {
        const operations: string[] = [];
        installFetchMock([{ status: 503 }]);

        await write(open({ onError: error => { operations.push(`${error.operation} ${error.method}`); error.done(); } }), [{ name: 'a' }]);

        expect(operations).toEqual(['write POST']);
    });
});
