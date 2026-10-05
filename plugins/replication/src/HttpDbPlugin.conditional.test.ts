import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { Result } from '@routier/core/results';
import { HttpDbPlugin } from './HttpDbPlugin';
import { HttpStatusError } from './httpUtils';
import { createQueryEvent, installFetchMock } from './__tests__/httpTestKit';

const createPlugin = () => new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}` });

describe('HttpDbPlugin.queryConditional', () => {
    let http: ReturnType<typeof installFetchMock>;

    beforeEach(() => {
        http = installFetchMock();
    });

    it('returns the rows and the etag of a modified response', async () => {
        http.respondToGet(() => ({ status: 200, body: [{ id: 'a', name: 'one' }], headers: { ETag: '"v1"' } }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'modified' ? [result.etag, result.data.value] : null).toEqual(['"v1"', [{ id: 'a', name: 'one' }]]);
    });

    it('returns a null etag when the response has none', async () => {
        http.respondToGet(() => ({ status: 200, body: [] }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'modified' ? result.etag : 'not modified').toBeNull();
    });

    it.each([
        ['"v1"', '"v1"'],
        [null, undefined],
    ])('sends If-None-Match %p', async (ifNoneMatch, sent) => {
        await createPlugin().queryConditional(createQueryEvent(), ifNoneMatch);

        expect(http.gets[0]?.headers['If-None-Match']).toBe(sent);
    });

    it('reports a 304 as not modified and records it', async () => {
        http.respondToGet(() => ({ status: 304 }));
        const event = createQueryEvent();

        const result = await createPlugin().queryConditional(event, '"v1"');

        expect([result.kind, event.executedQueries]).toEqual(['not-modified', [{ text: 'GET https://api.test/swrHardening (304)' }]]);
    });

    it('fails a plain query that is answered with a 304', async () => {
        http.respondToGet(() => ({ status: 304 }));
        const event = createQueryEvent();

        const result = await new Promise<{ ok: string, error?: Error }>(resolve => createPlugin().query(event, resolve));

        expect(result.ok === Result.ERROR && result.error instanceof HttpStatusError ? result.error.status : null).toBe(304);
    });

    it('does not share a conditional request with a plain one to the same url', async () => {
        http.respondToGet(() => ({ status: 200, body: [], delayMs: 10 }));
        const plugin = createPlugin();

        await Promise.all([plugin.queryConditional(createQueryEvent(), '"v1"'), plugin.queryConditional(createQueryEvent(), null)]);

        expect(http.gets.length).toBe(2);
    });

    it('shares two conditional requests with the same etag', async () => {
        http.respondToGet(() => ({ status: 200, body: [], delayMs: 10 }));
        const plugin = createPlugin();

        await Promise.all([plugin.queryConditional(createQueryEvent(), '"v1"'), plugin.queryConditional(createQueryEvent(), '"v1"')]);

        expect(http.gets.length).toBe(1);
    });

    it('fails when the server rejects the request', async () => {
        http.respondToGet(() => ({ status: 500 }));

        const result = await createPlugin().queryConditional(createQueryEvent(), '"v1"');

        expect(result.kind).toBe('failed');
    });
});

describe('HttpDbPlugin query attempts', () => {
    let http: ReturnType<typeof installFetchMock>;

    const datedSchema = s.define('conditionalDated', {
        id: s.string().key(),
        at: s.date(),
    }).compile();

    const otherSchema = s.define('conditionalOther', {
        id: s.string().key(),
    }).compile();

    beforeEach(() => {
        http = installFetchMock();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    it('makes a single attempt', async () => {
        http.respondToGet(() => ({ status: 500 }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect([result.kind, http.gets.length]).toEqual(['failed', 1]);
    });

    it('keeps the status, headers and body of a failed response', async () => {
        http.respondToGet(() => ({ status: 429, body: { reason: 'slow down' }, headers: { 'Retry-After': '7' } }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        const error = result.kind === 'failed' ? result.error : null;
        expect(error instanceof HttpStatusError ? [error.status, error.responseBody, error.headers.get('Retry-After'), error.retryAfterMs] : null)
            .toEqual([429, { reason: 'slow down' }, '7', 7_000]);
    });

    it('keeps a failed response body that is not JSON as text', async () => {
        http.respondToGet(() => ({ status: 502, text: 'Bad gateway' }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'failed' && result.error instanceof HttpStatusError ? result.error.responseBody : undefined).toBe('Bad gateway');
    });

    it('keeps no body for a failed response with an empty one', async () => {
        http.respondToGet(() => ({ status: 503, text: '' }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'failed' && result.error instanceof HttpStatusError ? result.error.responseBody : undefined).toBeNull();
    });

    it('reports a request that got no response as a network error', async () => {
        http.respondToGet(() => { throw new TypeError('offline'); });

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'failed' ? [result.error.name, result.error.message] : null).toEqual(['NetworkError', 'offline']);
    });

    it('reads the body as text when the response offers it', async () => {
        http.respondToGet(() => ({ status: 200, body: [{ id: 'json' }], text: '[{"id":"text"}]' }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'modified' ? result.data.value : null).toEqual([{ id: 'text' }]);
    });

    it('treats an empty body as no rows', async () => {
        http.respondToGet(() => ({ status: 200, text: '' }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind).toBe('modified');
    });

    it('revives dates and skips rows that are not objects', async () => {
        http.respondToGet(() => ({ status: 200, body: [null, { id: 'a', at: '2026-01-02T03:04:05.000Z' }] }));

        const result = await createPlugin().queryConditional(createQueryEvent(datedSchema), null);

        const rows = result.kind === 'modified' ? result.data.value : [];
        expect(Array.isArray(rows) && rows[1]?.at instanceof Date).toBe(true);
    });

    it('accepts a response without headers', async () => {
        global.fetch = (async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => [] })) as unknown as typeof fetch;

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'modified' ? result.etag : 'failed').toBeNull();
    });

    it('accepts response headers without a get method', async () => {
        global.fetch = (async () => ({ ok: true, status: 200, statusText: 'OK', headers: {}, json: async () => [] })) as unknown as typeof fetch;

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind === 'modified' ? result.etag : 'failed').toBeNull();
    });

    it('does not share requests for two different urls', async () => {
        http.respondToGet(() => ({ status: 200, body: [], delayMs: 10 }));
        const plugin = createPlugin();

        await Promise.all([plugin.queryConditional(createQueryEvent(), null), plugin.queryConditional(createQueryEvent(otherSchema), null)]);

        expect(http.gets.length).toBe(2);
    });

    it('names the status of an unexpected 304', async () => {
        http.respondToGet(() => ({ status: 304 }));

        const result = await new Promise<{ ok: string, error?: Error }>(resolve => createPlugin().query(createQueryEvent(), resolve));

        expect(result.error?.message).toBe('HTTP 304: Not Modified');
    });
});
