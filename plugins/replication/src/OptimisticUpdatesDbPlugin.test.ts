import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OptimisticUpdatesDbPlugin } from './OptimisticUpdatesDbPlugin';
import type { DbPluginQueryEvent, DbPluginBulkPersistEvent, IDbPlugin } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { s } from '@routier/core/schema';
import { uuid } from '@routier/core/utilities';
import { MemoryPlugin } from '@routier/memory-plugin';

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

function buildSchemas(): SchemaCollection {
    const schemas = new SchemaCollection();
    schemas.set(testSchema.id, testSchema as any);
    return schemas;
}

function createQueryEvent(): DbPluginQueryEvent<Record<string, unknown>, unknown> {
    return {
        id: uuid(8),
        schemas: buildSchemas(),
        source: 'test',
        action: 'query',
        operation: Query.EMPTY(testSchema as any) as any,
    };
}

function createPersistEvent(changes: { adds?: unknown[]; removes?: unknown[] }): DbPluginBulkPersistEvent {
    const operation = new BulkPersistChanges();
    const schemaChanges = operation.resolve(testSchema.id);
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

function queryRows(plugin: IDbPlugin): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        plugin.query(createQueryEvent(), (result) => {
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

function persist(plugin: IDbPlugin, changes: { adds?: unknown[]; removes?: unknown[] }): Promise<unknown> {
    return new Promise((resolve, reject) => {
        plugin.bulkPersist(createPersistEvent(changes), (result) => {
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

    it('surfaces hydration failure instead of serving an empty result', async () => {
        const failingSource: IDbPlugin = {
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
