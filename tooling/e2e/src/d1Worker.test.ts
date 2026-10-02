import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { join } from 'node:path';

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

type DescribedOrder = { customer: string; total: number; placedAtIsDate: boolean; placedAt: string };
type QueryResponse = { overTwenty: DescribedOrder[]; placedSince: DescribedOrder[]; count: number; sum: number };

const order = (customer: string, total: number, placedAt: string): DescribedOrder => ({ customer, total, placedAtIsDate: true, placedAt });

suite('a Cloudflare Worker using the D1 plugin, running in workerd', () => {
    let miniflare: Miniflare;

    const call = async <T>(route: string): Promise<T> => {
        const response = await miniflare.dispatchFetch(`http://worker${route}`);
        const body = await response.text();
        if (!response.ok) throw new Error(`${route} returned ${response.status}: ${body}`);
        return JSON.parse(body) as T;
    };

    beforeAll(async () => {
        const bundle = await build({
            entryPoints: [join(__dirname, 'workers', 'd1Worker.ts')],
            bundle: true,
            write: false,
            format: 'esm',
            platform: 'neutral',
            conditions: ['workerd', 'worker', 'browser'],
            mainFields: ['module', 'main'],
            logLevel: 'silent',
        });

        miniflare = new Miniflare({
            modules: true,
            script: bundle.outputFiles[0].text,
            compatibilityDate: '2025-09-01',
            d1Databases: { DB: 'worker-shop' },
        });

        await miniflare.ready;
    }, 120_000);

    afterAll(async () => {
        await miniflare?.dispose();
    });

    it('builds a store and saves through the binding', async () => {
        await expect(call('/seed')).resolves.toEqual({ seeded: 3 });
    });

    it('filters, sorts, aggregates, and reads dates back as Date instances from a new store', async () => {
        await expect(call<QueryResponse>('/query')).resolves.toEqual({
            overTwenty: [order('ada', 40, '2026-01-02T03:04:05.678Z'), order('cy', 99, '2026-03-01T12:00:00.000Z')],
            placedSince: [order('bob', 15, '2026-02-01T00:00:00.000Z'), order('cy', 99, '2026-03-01T12:00:00.000Z')],
            count: 3,
            sum: 154,
        });
    });

    it('persists an update and a removal', async () => {
        await expect(call<QueryResponse>('/mutate')).resolves.toEqual({
            overTwenty: [order('bob', 25, '2026-02-01T00:00:00.000Z'), order('ada', 40, '2026-01-02T03:04:05.678Z')],
            placedSince: [order('bob', 25, '2026-02-01T00:00:00.000Z')],
            count: 2,
            sum: 65,
        });
    });

    it('refreshes a live query inside the Worker, where BroadcastChannel does not exist', async () => {
        const { deliveries } = await call<{ deliveries: number[] }>('/live');

        expect(deliveries[0]).toBe(2);
        expect(deliveries).toContain(3);
    });
});
