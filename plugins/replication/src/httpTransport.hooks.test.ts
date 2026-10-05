import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import type { DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { type InferRoot, s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { HttpStatusError } from './httpUtils';
import { HttpTransportDbPlugin } from './HttpTransportDbPlugin';
import type { HttpRequestError, SyncEvent } from './syncHooks';
import { createQueryEvent } from './__tests__/httpTestKit';

const URL = 'https://api.test/routier';

const alpha = s.define('transport_alpha', { id: s.string().key(), name: s.string() }).compile();
const beta = s.define('transport_beta', { id: s.string().key(), name: s.string() }).compile();
const gamma = s.define('transport_gamma', { id: s.string().key(), name: s.string() }).compile();

type Call = { url: string; init: { headers: Record<string, string>; body: string } };
type Settled = { ok: string; error?: Error };

const emptyRead = { ok: true, kind: 'query', value: [] };
const persisted = { ok: true, kind: 'persist', changes: [] };

const respond = (body: unknown, init: ResponseInit = {}) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), init);

describe('HttpTransportDbPlugin hooks', () => {
    let calls: Call[];
    let replies: Array<() => Response>;
    let failure: Error | null;

    const open = (hooks: { onError?: (error: HttpRequestError) => void; onEvent?: (event: SyncEvent) => void } = {}) =>
        new HttpTransportDbPlugin({ url: URL, getHeaders: () => ({ Authorization: 'Bearer token' }), ...hooks });

    const read = (plugin: HttpTransportDbPlugin) => new Promise<Settled>((resolve) => {
        plugin.query(createQueryEvent(alpha), (result) => resolve(result.ok === Result.ERROR ? { ok: result.ok, error: result.error } : { ok: result.ok }));
    });

    const write = (plugin: HttpTransportDbPlugin, event: DbPluginBulkPersistEvent) => new Promise<Settled>((resolve) => {
        plugin.bulkPersist(event, (result) => resolve(result.ok === Result.ERROR ? { ok: result.ok, error: result.error } : { ok: result.ok }));
    });

    const twoCollections = (): DbPluginBulkPersistEvent => {
        const operation = new BulkPersistChanges();
        const alphaChanges = operation.resolve<InferRoot<typeof alpha>>(alpha.id);
        alphaChanges.adds.push({ id: 'a', name: 'A' });
        alphaChanges.updates.push({ entity: { id: 'u', name: 'U' }, changeType: 'markedDirty', delta: {} });
        operation.resolve<InferRoot<typeof beta>>(beta.id).removes.push({ id: 'b', name: 'B' });
        operation.resolve(gamma.id);

        return {
            id: uuid(8),
            schemas: new SchemaCollection().set(alpha.id, alpha).set(beta.id, beta).set(gamma.id, gamma),
            source: 'test',
            action: 'persist',
            operation,
        };
    };

    beforeEach(() => {
        calls = [];
        replies = [];
        failure = null;
        global.fetch = jest.fn(async (url: unknown, init?: unknown) => {
            calls.push({ url: String(url), init: init as Call['init'] });

            if (failure != null) {
                throw failure;
            }

            return (replies.shift() ?? respond(emptyRead))();
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('posts JSON with the headers the caller supplies', async () => {
        await read(open());

        expect([calls[0]?.url, calls[0]?.init.headers]).toEqual([URL, { 'Content-Type': 'application/json', Authorization: 'Bearer token' }]);
    });

    it('describes a request that got no response as a network failure of the read', async () => {
        const seen: HttpRequestError[] = [];
        failure = new TypeError('fetch failed');

        const result = await read(open({ onError: error => { seen.push(error); error.done(); } }));

        const [error] = seen;
        expect([error?.kind, error?.operation, error?.collectionName, error?.method, error?.url, error?.attempt])
            .toEqual(['network', 'read', 'transport_alpha', 'POST', URL, 1]);
        expect([result.ok, result.error?.name, result.error?.message]).toEqual([Result.ERROR, 'NetworkError', 'fetch failed']);
    });

    it('describes a refused request with its status and the Routier answer as the body', async () => {
        const seen: HttpRequestError[] = [];
        replies.push(respond({ ok: false, error: 'down for maintenance' }, { status: 503, statusText: 'Service Unavailable' }));

        const result = await read(open({ onError: error => { seen.push(error); error.done(); } }));

        const [error] = seen;
        expect(error?.kind === 'http' ? [error.status, error.body] : null).toEqual([503, { ok: false, error: 'down for maintenance' }]);
        expect(result.error?.message).toBe('HTTP 503: down for maintenance');
    });

    it('uses the status text when a failed response carries an answer that is not a refusal', async () => {
        replies.push(respond({ ok: true, kind: 'query', value: [] }, { status: 500, statusText: 'Server Error' }));

        const result = await read(open());

        expect(result.error?.message).toBe('HTTP 500: Server Error');
    });

    it('keeps a failed response body that is not a Routier answer as text', async () => {
        const bodies: unknown[] = [];
        replies.push(respond('Bad gateway', { status: 502, statusText: 'Bad Gateway' }));

        const result = await read(open({ onError: error => { bodies.push(error.kind === 'http' ? error.body : null); error.done(); } }));

        expect([bodies, result.error?.message]).toEqual([['Bad gateway'], 'HTTP 502: Bad Gateway']);
    });

    it('fails a successful response that is not a Routier answer without asking onError', async () => {
        const onError = jest.fn();
        replies.push(respond('<html>not here</html>'));

        const result = await read(open({ onError }));

        expect(result.error?.message).toContain('with a body that is not a Routier response');
        expect(onError).not.toHaveBeenCalled();
    });

    it('answers the read that onError retried, and reports it once', async () => {
        const events: SyncEvent[] = [];
        replies.push(respond({ ok: false, error: 'busy' }, { status: 503 }), respond(emptyRead));

        const result = await read(open({ onError: error => void error.retry(), onEvent: event => events.push(event) }));

        expect([result.ok, calls.length, events]).toEqual([Result.SUCCESS, 2, [{ type: 'read', ok: true, collectionName: 'transport_alpha', status: 200 }]]);
    });

    it('reports a failed read with its status', async () => {
        const events: SyncEvent[] = [];
        replies.push(respond({ ok: false, error: 'busy' }, { status: 503 }));

        await read(open({ onEvent: event => events.push(event) }));

        expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'transport_alpha', status: 503, error: expect.any(HttpStatusError) }]);
    });

    it('fails and reports a read the server refused in its answer', async () => {
        const events: SyncEvent[] = [];
        const onError = jest.fn();
        replies.push(respond({ ok: false, error: 'not allowed' }));

        const result = await read(open({ onError, onEvent: event => events.push(event) }));

        expect([result.error?.message, onError.mock.calls.length]).toEqual(['not allowed', 0]);
        expect(events).toEqual([{ type: 'read', ok: false, collectionName: 'transport_alpha', status: null, error: expect.any(Error) }]);
    });

    it('fails a read answered with the wrong kind of response', async () => {
        replies.push(respond(persisted));

        const result = await read(open());

        expect(result.error?.message).toBe("Expected a query response and received 'persist'.");
    });

    it('describes a failed write with every collection it carried', async () => {
        const seen: HttpRequestError[] = [];
        replies.push(respond({ ok: false, error: 'stale' }, { status: 409 }));

        await write(open({ onError: error => { seen.push(error); error.done(); } }), twoCollections());

        expect(seen.map(error => [error.operation, error.collectionName, error.method])).toEqual([['write', 'transport_alpha, transport_beta', 'POST']]);
    });

    it('reports the changes of each collection a failed write could not save, and fails the save', async () => {
        const events: SyncEvent[] = [];
        replies.push(respond({ ok: false, error: 'stale' }, { status: 409 }));

        const result = await write(open({ onEvent: event => events.push(event) }), twoCollections());

        expect(result.ok).toBe(Result.ERROR);
        expect(events).toEqual([
            { type: 'changes-rejected', collectionName: 'transport_alpha', changes: [{ kind: 'add', entity: { id: 'a', name: 'A' } }, { kind: 'update', entity: { id: 'u', name: 'U' } }], conflict: true, status: 409, error: expect.any(HttpStatusError) },
            { type: 'changes-rejected', collectionName: 'transport_beta', changes: [{ kind: 'remove', entity: { id: 'b', name: 'B' } }], conflict: true, status: 409, error: expect.any(HttpStatusError) },
        ]);
    });

    it('reports a write the server refused in its answer as rejected, without a conflict', async () => {
        const events: SyncEvent[] = [];
        replies.push(respond({ ok: false, error: 'read only' }));

        const result = await write(open({ onEvent: event => events.push(event) }), twoCollections());

        expect(result.error?.message).toBe('read only');
        expect(events.map(event => (event.type === 'changes-rejected' ? [event.collectionName, event.conflict, event.status] : null)))
            .toEqual([['transport_alpha', false, null], ['transport_beta', false, null]]);
    });

    it('saves a write that onError retried, without reporting anything', async () => {
        const events: SyncEvent[] = [];
        replies.push(respond({ ok: false, error: 'busy' }, { status: 503 }), respond(persisted));

        const result = await write(open({ onError: error => void error.retry(), onEvent: event => events.push(event) }), twoCollections());

        expect([result.ok, calls.length, events]).toEqual([Result.SUCCESS, 2, []]);
    });

    it('fails a write answered with the wrong kind of response', async () => {
        replies.push(respond(emptyRead));

        const result = await write(open(), twoCollections());

        expect(result.error?.message).toBe("Expected a persist response and received 'query'.");
    });
});
