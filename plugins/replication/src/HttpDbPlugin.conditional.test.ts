import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { s } from '@routier/core/schema';
import { logger } from '@routier/core/utilities';
import { Result } from '@routier/core/results';
import { HttpDbPlugin } from './HttpDbPlugin';
import { HttpStatusError } from './httpUtils';
import { createQueryEvent, installFetchMock } from './__tests__/httpTestKit';

const createPlugin = () => new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 1 });

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

    it('retries a failed request after a backoff and logs each step', async () => {
        const warn = jest.spyOn(logger, 'warn');
        const error = jest.spyOn(logger, 'error');
        http.respondToGet(() => ({ status: 500 }));
        const plugin = new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 2, queryRetryBaseDelayMs: 1 });
        const event = createQueryEvent();

        const result = await plugin.queryConditional(event, null);

        expect([result.kind, http.gets.length]).toEqual(['failed', 2]);
        expect(warn).toHaveBeenCalledWith('[HttpDbPlugin] query failed, retrying', expect.objectContaining({ collectionName: 'swrHardening', attempt: 1, maxAttempts: 2 }));
        expect(error).toHaveBeenCalledWith('[HttpDbPlugin] query failed', expect.objectContaining({ collectionName: 'swrHardening', eventId: event.id }));
    });

    it('waits for the backoff before retrying', async () => {
        jest.useFakeTimers();
        http.respondToGet(() => ({ status: 500 }));
        const plugin = new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 2, queryRetryBaseDelayMs: 1_000 });

        const pending = plugin.queryConditional(createQueryEvent(), null);
        await jest.advanceTimersByTimeAsync(400);
        const beforeBackoff = http.gets.length;
        await jest.advanceTimersByTimeAsync(1_000);
        await pending;

        expect([beforeBackoff, http.gets.length]).toEqual([1, 2]);
    });

    it('retries a network error rather than treating it as an auth error', async () => {
        http.respondToGet(() => { throw new Error('offline'); });
        const plugin = new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 2, queryRetryBaseDelayMs: 1 });

        const result = await plugin.queryConditional(createQueryEvent(), null);

        expect([result.kind, http.gets.length]).toEqual(['failed', 2]);
    });

    it('does not spend a retry on a successful re-auth', async () => {
        let calls = 0;
        http.respondToGet(() => (++calls === 1 ? { status: 401 } : { status: 500 }));
        const plugin = new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 2, queryRetryBaseDelayMs: 1, onAuthError: async () => true });

        await plugin.queryConditional(createQueryEvent(), null);

        expect(http.gets.length).toBe(3);
    });

    it('retries once after a successful re-auth and logs it', async () => {
        const info = jest.spyOn(logger, 'info');
        let calls = 0;
        http.respondToGet(() => (++calls === 1 ? { status: 401 } : { status: 200, body: [] }));
        const plugin = new HttpDbPlugin({ getUrl: (collection) => `https://api.test/${collection}`, queryRetryMaxAttempts: 1, onAuthError: async () => true });

        const result = await plugin.queryConditional(createQueryEvent(), null);

        expect(result.kind).toBe('modified');
        expect(info).toHaveBeenCalledWith('[HttpDbPlugin] re-auth succeeded, retrying query once', { collectionName: 'swrHardening' });
    });

    it('stops on an auth error and logs it', async () => {
        const warn = jest.spyOn(logger, 'warn');
        http.respondToGet(() => ({ status: 403 }));

        const result = await createPlugin().queryConditional(createQueryEvent(), null);

        expect(result.kind).toBe('failed');
        expect(warn).toHaveBeenCalledWith('[HttpDbPlugin] query auth error, not retrying', expect.objectContaining({ collectionName: 'swrHardening', error: expect.any(HttpStatusError) }));
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
