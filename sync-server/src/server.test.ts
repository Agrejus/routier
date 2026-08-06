import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { SyncServer, startSyncServer } from './index';

/**
 * The server's own tests.
 *
 * It is test infrastructure, so a scenario that fails through it has two possible causes and
 * only one of them is interesting. These pin the boring one: that the server honours the
 * query parameters it claims to, dedupes replays, and that the admin channel really does
 * change state without the client's involvement.
 */

describe('SyncServer', () => {
    let server: SyncServer;

    const get = async (path: string): Promise<{ status: number; body: any }> => {
        const response = await fetch(`${server.origin}${path}`);
        return { status: response.status, body: await response.json() };
    };

    const post = async (path: string, body: unknown): Promise<{ status: number; body: any }> => {
        const response = await fetch(`${server.origin}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
    };

    beforeEach(async () => {
        server = await startSyncServer();
    });

    afterEach(async () => {
        await server.stop();
    });

    describe('reads', () => {
        beforeEach(() => {
            server.admin.seed('widgets', [
                { id: 'a', name: 'alpha', price: 10, category: 'tools' },
                { id: 'b', name: 'bravo', price: 30, category: 'tools' },
                { id: 'c', name: 'charlie', price: 20, category: 'toys' },
            ]);
        });

        it('returns the whole collection with no parameters', async () => {
            const { status, body } = await get('/widgets');

            expect(status).toBe(200);
            expect(body.map((r: any) => r.id)).toEqual(['a', 'b', 'c']);
        });

        it('returns an empty array for a collection it has never seen', async () => {
            expect((await get('/unknown')).body).toEqual([]);
        });

        it('applies an equality filter', async () => {
            const filter = JSON.stringify({
                type: 'comparator',
                comparator: 'equals',
                left: { type: 'property', name: 'category' },
                right: { type: 'value', value: 'tools' },
            });

            const { body } = await get(`/widgets?filter=${encodeURIComponent(filter)}`);

            expect(body.map((r: any) => r.id)).toEqual(['a', 'b']);
        });

        it('applies a negated filter', async () => {
            const filter = JSON.stringify({
                type: 'comparator',
                comparator: 'equals',
                negated: true,
                left: { type: 'property', name: 'category' },
                right: { type: 'value', value: 'tools' },
            });

            expect((await get(`/widgets?filter=${encodeURIComponent(filter)}`)).body.map((r: any) => r.id))
                .toEqual(['c']);
        });

        it('applies a comparison filter', async () => {
            const filter = JSON.stringify({
                type: 'comparator',
                comparator: 'greater-than',
                left: { type: 'property', name: 'price' },
                right: { type: 'value', value: 15 },
            });

            expect((await get(`/widgets?filter=${encodeURIComponent(filter)}`)).body.map((r: any) => r.id))
                .toEqual(['b', 'c']);
        });

        it('applies a conjunction', async () => {
            const filter = JSON.stringify({
                type: 'operator',
                operator: '&&',
                left: {
                    type: 'comparator',
                    comparator: 'equals',
                    left: { type: 'property', name: 'category' },
                    right: { type: 'value', value: 'tools' },
                },
                right: {
                    type: 'comparator',
                    comparator: 'greater-than',
                    left: { type: 'property', name: 'price' },
                    right: { type: 'value', value: 15 },
                },
            });

            expect((await get(`/widgets?filter=${encodeURIComponent(filter)}`)).body.map((r: any) => r.id))
                .toEqual(['b']);
        });

        it('handles a value-on-left comparator', async () => {
            // The client normalizes to property-on-left, but the shape is legal and a server
            // that silently returned everything here would mask a real filter bug.
            const filter = JSON.stringify({
                type: 'comparator',
                comparator: 'equals',
                left: { type: 'value', value: 'toys' },
                right: { type: 'property', name: 'category' },
            });

            expect((await get(`/widgets?filter=${encodeURIComponent(filter)}`)).body.map((r: any) => r.id))
                .toEqual(['c']);
        });

        it('sorts ascending and descending', async () => {
            expect((await get('/widgets?sort=price:asc')).body.map((r: any) => r.price)).toEqual([10, 20, 30]);
            expect((await get('/widgets?sort=price:desc')).body.map((r: any) => r.price)).toEqual([30, 20, 10]);
        });

        it('applies skip and take', async () => {
            expect((await get('/widgets?sort=price:asc&skip=1&take=1')).body.map((r: any) => r.id)).toEqual(['c']);
            expect((await get('/widgets?sort=price:asc&take=2')).body.map((r: any) => r.id)).toEqual(['a', 'c']);
            expect((await get('/widgets?sort=price:asc&skip=2')).body.map((r: any) => r.id)).toEqual(['b']);
        });

        it('records the query parameters it was sent', async () => {
            await get('/widgets?take=1');

            const entry = server.requestLog.at(-1)!;

            expect(entry.method).toBe('GET');
            expect(entry.collection).toBe('widgets');
            expect(entry.query.take).toBe('1');
        });
    });

    describe('writes', () => {
        it('applies adds, updates and removes', async () => {
            await post('/widgets', { adds: [{ id: 'a', name: 'alpha' }] });
            expect(server.admin.rows('widgets')).toEqual([{ id: 'a', name: 'alpha' }]);

            await post('/widgets', { updates: [{ id: 'a', name: 'alpha v2' }] });
            expect(server.admin.rows('widgets')).toEqual([{ id: 'a', name: 'alpha v2' }]);

            await post('/widgets', { removes: [{ id: 'a' }] });
            expect(server.admin.rows('widgets')).toEqual([]);
        });

        it('returns the stored rows as `saved`', async () => {
            const { body } = await post('/widgets', { adds: [{ id: 'a', name: 'alpha' }] });

            expect(body.saved).toEqual([{ id: 'a', name: 'alpha' }]);
        });

        it('applies the stamp so the server can be canonical', async () => {
            const stamped = await startSyncServer({
                stamp: (row, { kind }) => ({ ...row, origin: `server:${kind}` }),
            });

            try {
                const response = await fetch(`${stamped.origin}/widgets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adds: [{ id: 'a', name: 'alpha' }] }),
                });
                const body = await response.json() as any;

                expect(body.saved[0].origin).toBe('server:add');
                expect(stamped.admin.rows('widgets')[0].origin).toBe('server:add');
            } finally {
                await stamped.stop();
            }
        });

        it('ignores a replayed opId', async () => {
            // A client that never saw its response retries. Without dedupe one write becomes
            // two, which is the failure mode the meta.opIds block exists to prevent.
            const body = {
                adds: [{ id: 'a', name: 'alpha' }],
                meta: { opIds: { adds: ['op-1'] } },
            };

            await post('/widgets', body);
            await post('/widgets', body);

            expect(server.admin.rows('widgets')).toHaveLength(1);
        });

        it('accepts a different opId for the same row', async () => {
            await post('/widgets', { adds: [{ id: 'a', name: 'alpha' }], meta: { opIds: { adds: ['op-1'] } } });
            await post('/widgets', { updates: [{ id: 'a', name: 'beta' }], meta: { opIds: { updates: ['op-2'] } } });

            expect(server.admin.rows('widgets')).toEqual([{ id: 'a', name: 'beta' }]);
        });

        it('rejects a malformed body', async () => {
            const response = await fetch(`${server.origin}/widgets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not json',
            });

            expect(response.status).toBe(400);
        });
    });

    describe('admin channel', () => {
        // The whole reason this package exists: changing state with no client involved.
        it('seeds, upserts, patches and removes', async () => {
            server.admin.seed('widgets', [{ id: 'a', name: 'alpha' }]);
            expect(server.admin.rows('widgets')).toHaveLength(1);

            server.admin.upsert('widgets', [{ id: 'b', name: 'bravo' }]);
            expect(server.admin.rows('widgets').map(r => r.id)).toEqual(['a', 'b']);

            server.admin.patch('widgets', 'a', { name: 'alpha v2' });
            expect(server.admin.rows('widgets')[0].name).toBe('alpha v2');

            expect(server.admin.remove('widgets', ['a', 'missing'])).toBe(1);
            expect(server.admin.rows('widgets').map(r => r.id)).toEqual(['b']);
        });

        it('is visible to the next GET', async () => {
            server.admin.seed('widgets', [{ id: 'a', name: 'alpha' }]);
            expect((await get('/widgets')).body).toHaveLength(1);

            server.admin.remove('widgets', ['a']);
            expect((await get('/widgets')).body).toEqual([]);
        });

        it('patching a missing row does nothing', () => {
            server.admin.patch('widgets', 'nope', { name: 'x' });

            expect(server.admin.rows('widgets')).toEqual([]);
        });
    });

    describe('injected faults', () => {
        it('fails the next N requests then recovers', async () => {
            server.failNextRequests = 2;
            server.failStatus = 503;

            expect((await get('/widgets')).status).toBe(503);
            expect((await get('/widgets')).status).toBe(503);
            expect((await get('/widgets')).status).toBe(200);
        });

        it('adds latency', async () => {
            server.latencyMs = 60;

            const started = Date.now();
            await get('/widgets');

            expect(Date.now() - started).toBeGreaterThanOrEqual(50);
        });

        it('counts GETs per collection', async () => {
            await get('/widgets');
            await get('/widgets');
            await get('/others');

            expect(server.getCount('widgets')).toBe(2);
            expect(server.getCount()).toBe(3);
        });
    });
});
