import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HttpDbPlugin } from './HttpDbPlugin';
import type { DbPluginQueryEvent, DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
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

    it('does not retry queries when queryRetryBaseDelayMs is unset (single attempt)', (done) => {
        const calls = installFetchMock([{ status: 500 }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.ERROR);
            expect(calls).toHaveLength(1);
            done();
        });
    });

    it('retries queries with backoff and succeeds', (done) => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            queryRetryBaseDelayMs: 1,
            queryRetryMaxAttempts: 3,
        });
        const calls = installFetchMock([{ status: 500 }, { status: 200, body: [] }]);

        plugin.query(createQueryEvent(), (result) => {
            expect(result.ok).toBe(Result.SUCCESS);
            expect(calls).toHaveLength(2);
            done();
        });
    });

    it('never retries a 401 even when retries are configured', (done) => {
        plugin = new HttpDbPlugin({
            getUrl: (collection) => `https://api.test/${collection}`,
            queryRetryBaseDelayMs: 1,
            queryRetryMaxAttempts: 5,
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
