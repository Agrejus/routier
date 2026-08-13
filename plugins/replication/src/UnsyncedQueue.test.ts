import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MemoryPlugin } from '@routier/memory-plugin';
import type { IDbPlugin } from '@routier/core/plugins';
import { PluginEventResult, Result } from '@routier/core/results';
import { uuid } from '@routier/core/utilities';
import { UnsyncedQueue } from './UnsyncedQueue';
import type { QueuedChange } from './UnsyncedQueue';
import { buildAuthErrorEvent } from './auth';
import { HttpStatusError } from './httpUtils';
import { readQueueRows, testSchema, writeQueueRows } from './__tests__/httpTestKit';

/**
 * The queue is where the "no acked write is lost" promise actually lives, so its failure paths
 * matter as much as its happy path: a store that rejects, a row whose JSON no longer parses, a
 * row written by an older version of this code. Nothing here should ever throw at the caller or
 * quietly drop an obligation.
 */

const COLLECTION = 'swrHardening';

/** A store whose responses are dictated by the test, including failures the real one rarely produces. */
/** Models Dexie's insert-only add semantics while delegating storage/query behavior to MemoryPlugin. */
function insertOnlyStore(): IDbPlugin {
    const inner = new MemoryPlugin(`strict-queue-${uuid(8)}`);
    const ids = new Set<string>();

    return {
        query: (event, done) => inner.query(event, done),
        bulkPersist: (event, done) => {
            for (const [, changes] of event.operation) {
                const duplicate = changes.adds.find((row) => ids.has(String((row as unknown as { id: unknown }).id)));
                if (duplicate != null) {
                    done(PluginEventResult.error(event.id, new Error('duplicate insert')) as never);
                    return;
                }
            }

            inner.bulkPersist(event, (result) => {
                if (result.ok === Result.SUCCESS) {
                    for (const [, changes] of event.operation) {
                        for (const row of changes.adds) ids.add(String((row as unknown as { id: unknown }).id));
                        for (const row of changes.removes) ids.delete(String((row as unknown as { id: unknown }).id));
                    }
                }
                done(result);
            });
        },
        destroy: (event, done) => inner.destroy(event, done),
    } as IDbPlugin;
}

function stubStore(options: {
    rows?: unknown;
    queryError?: Error;
    persistError?: Error;
    onPersist?: () => void;
    onQuery?: () => void;
}): IDbPlugin {
    return {
        query: (event, done) => {
            options.onQuery?.();
            if (options.queryError != null) {
                done(PluginEventResult.error(event.id, options.queryError) as never);
                return;
            }
            const value = options.rows;
            done(PluginEventResult.success(event.id, {
                value,
                isEmpty: Array.isArray(value) ? value.length === 0 : value == null,
                forEach: (cb: (item: unknown) => void) => {
                    if (Array.isArray(value)) value.forEach(cb);
                    else if (value != null) cb(value);
                },
            }) as never);
        },
        bulkPersist: (event, done) => {
            options.onPersist?.();
            if (options.persistError != null) {
                done(PluginEventResult.error(event.id, options.persistError) as never);
                return;
            }
            done(PluginEventResult.success(event.id, new Map()) as never);
        },
        destroy: (event, done) => done(PluginEventResult.success(event.id) as never),
    } as IDbPlugin;
}

describe('UnsyncedQueue against a real store', () => {
    let queueStore: MemoryPlugin;
    let queue: UnsyncedQueue;

    beforeEach(() => {
        queueStore = new MemoryPlugin(`queue-${uuid(8)}`);
        queue = new UnsyncedQueue(queueStore);
    });

    it('stamps a revision, an opId and a seq on every enqueued change', async () => {
        const first: QueuedChange = { kind: 'add', entity: { id: 'a', name: 'A' } };
        const second: QueuedChange = { kind: 'add', entity: { id: 'b', name: 'B' } };

        await queue.addMany(testSchema as never, [first, second]);

        for (const change of [first, second]) {
            expect(change.revision).toEqual(expect.any(String));
            expect(change.opId).toEqual(expect.any(String));
            expect(change.seq).toEqual(expect.any(Number));
        }
        expect(first.opId).not.toBe(second.opId);
        expect(first.revision).not.toBe(second.revision);
        // seq is what orders supersede decisions, so it must strictly increase
        expect(second.seq!).toBeGreaterThan(first.seq!);

        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.status)).toEqual(['pending', 'pending']);
        expect(rows.map((r) => r.attempts)).toEqual([0, 0]);
    });

    it('overwrites a re-enqueued row instead of inserting the same durable key twice', async () => {
        const strictStore = insertOnlyStore();
        const strictQueue = new UnsyncedQueue(strictStore);

        await strictQueue.addMany(testSchema as never, [{ kind: 'update', entity: { id: 'same', name: 'First' } }]);
        await strictQueue.addMany(testSchema as never, [{ kind: 'update', entity: { id: 'same', name: 'Second' } }]);

        const payload = await strictQueue.getUnsyncedEntitiesForFlush(COLLECTION);
        expect(payload.updates).toEqual([{ id: 'same', name: 'Second' }]);
        expect(payload.units).toHaveLength(1);
    });

    it('keeps existing stamps when a change is re-enqueued', async () => {
        const change: QueuedChange = { kind: 'add', entity: { id: 'a', name: 'A' }, revision: 'rev-1', opId: 'op-1', seq: 42 };

        await queue.addMany(testSchema as never, [change]);

        expect(change).toEqual(expect.objectContaining({ revision: 'rev-1', opId: 'op-1', seq: 42 }));
        const [row] = await readQueueRows(queueStore);
        expect(row).toEqual(expect.objectContaining({ revision: 'rev-1', opId: 'op-1', seq: 42 }));
    });

    it('scopes id keys and collection names to the collection asked for', async () => {
        const otherSchema = { ...(testSchema as never as Record<string, unknown>), collectionName: 'otherCollection' };

        await queue.add(testSchema as never, { id: 'mine', name: 'Mine' }, 'add');
        await queue.add(otherSchema as never, { id: 'theirs', name: 'Theirs' }, 'add');

        expect(await queue.getUnsyncedIdKeys(COLLECTION)).toEqual(new Set(['["mine"]']));
        expect(await queue.getUnsyncedIdKeys('otherCollection')).toEqual(new Set(['["theirs"]']));
        expect((await queue.getUnsyncedCollections()).sort()).toEqual(['otherCollection', COLLECTION]);
        expect(await queue.getPendingCount()).toBe(2);

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);
        expect(payload.adds).toEqual([expect.objectContaining({ id: 'mine' })]);
    });

    it('flushes an update on its own as an update, with its opId', async () => {
        const change: QueuedChange = { kind: 'update', entity: { id: 'u1', name: 'Edited' } };
        await queue.addMany(testSchema as never, [change]);

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        expect(payload.adds).toEqual([]);
        expect(payload.removes).toEqual([]);
        expect(payload.updates).toEqual([{ id: 'u1', name: 'Edited' }]);
        expect(payload.opIds).toEqual({ adds: [], updates: [change.opId], removes: [] });
    });

    it('flushes a remove with its own opId', async () => {
        const change: QueuedChange = { kind: 'remove', entity: { id: 'r1', name: 'Gone' } };
        await queue.addMany(testSchema as never, [change]);

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        expect(payload.removes).toEqual([{ id: 'r1', name: 'Gone' }]);
        expect(payload.opIds).toEqual({ adds: [], updates: [], removes: [change.opId] });
        // The unit's kind decides the body shape when the flush isolates this change, so it
        // has to be the literal kind — not merely "whatever falls through to removes"
        expect(payload.units[0].kind).toBe('remove');
    });

    // Coalescing has to obey `seq`, not the order the store happens to return rows in. Both
    // insertion orders are tested because each one alone is satisfied by a broken comparator.
    it.each([
        { label: 'newest row first', order: ['update', 'add'] as const },
        { label: 'newest row last', order: ['add', 'update'] as const },
    ])('sends the highest-seq entity regardless of row order ($label)', async ({ order }) => {
        const rows = {
            add: {
                id: [COLLECTION, 'add', '["e1"]'].join('\u0000'),
                collectionName: COLLECTION,
                recordIds: '["e1"]',
                changeKind: 'add',
                entityJson: JSON.stringify({ id: 'e1', name: 'oldest' }),
                opId: 'op-add',
                seq: 10,
                status: 'pending',
            },
            update: {
                id: [COLLECTION, 'update', '["e1"]'].join('\u0000'),
                collectionName: COLLECTION,
                recordIds: '["e1"]',
                changeKind: 'update',
                entityJson: JSON.stringify({ id: 'e1', name: 'newest' }),
                opId: 'op-update',
                seq: 30,
                status: 'pending',
            },
        };
        await writeQueueRows(queueStore, order.map((kind) => rows[kind]));

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        // A pending add forces the kind (the server has never seen this entity)...
        expect(payload.units[0].kind).toBe('add');
        // ...but the payload and its opId come from the newest row
        expect(payload.adds).toEqual([{ id: 'e1', name: 'newest' }]);
        expect(payload.opIds.adds).toEqual(['op-update']);
    });

    it('skips a row whose entityJson no longer parses instead of failing the flush', async () => {
        await queue.add(testSchema as never, { id: 'good', name: 'Good' }, 'add');
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["broken"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["broken"]',
            changeKind: 'add',
            entityJson: '{not json',
            status: 'pending',
        }]);

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        expect(payload.adds).toEqual([expect.objectContaining({ id: 'good' })]);
        expect(payload.units).toHaveLength(1);
        // The unparseable row is left in place rather than sent as garbage or thrown over
        expect(await readQueueRows(queueStore)).toHaveLength(2);
    });

    it('dead-letters a row it cannot parse, reporting a null entity rather than throwing', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'update', '["broken"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["broken"]',
            changeKind: 'update',
            entityJson: 'nonsense',
            opId: 'op-broken',
            status: 'pending',
        }]);
        const rows = await readQueueRows(queueStore);

        const reported = await queue.deadLetter(rows as never);

        expect(reported).toEqual([{
            collectionName: COLLECTION,
            kind: 'update',
            entity: null,
            opId: 'op-broken',
        }]);
        expect((await readQueueRows(queueStore))[0].status).toBe('dead');
    });

    it('reports a null opId for a dead-lettered row that never had one', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["legacy"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["legacy"]',
            entityJson: JSON.stringify({ id: 'legacy', name: 'Old' }),
        }]);
        const rows = await readQueueRows(queueStore);

        const reported = await queue.deadLetter(rows as never);

        expect(reported).toEqual([expect.objectContaining({ kind: 'add', opId: null })]);
    });

    it('treats an unrecognized changeKind as an add', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["odd"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["odd"]',
            changeKind: 'sideways',
            entityJson: JSON.stringify({ id: 'odd', name: 'Odd' }),
            status: 'pending',
        }]);

        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        expect(payload.adds).toEqual([expect.objectContaining({ id: 'odd' })]);
        expect(payload.units[0].kind).toBe('add');
    });

    it('counts failed attempts from nothing upwards', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["counted"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["counted"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'counted', name: 'Counted' }),
            status: 'pending',
        }]);

        await queue.recordFailedAttempt(await readQueueRows(queueStore) as never);
        expect((await readQueueRows(queueStore))[0].attempts).toBe(1);

        await queue.recordFailedAttempt(await readQueueRows(queueStore) as never);
        expect((await readQueueRows(queueStore))[0].attempts).toBe(2);
    });

    it('dequeues by id when neither side carries a revision', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["norev"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["norev"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'norev', name: 'No revision' }),
            status: 'pending',
        }]);

        await queue.remove(testSchema as never, { id: 'norev', name: 'No revision' }, 'add');

        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('dequeues a legacy row without a revision even when the confirmed change has one', async () => {
        // The row predates the revision column; the change carries one. There is nothing to
        // compare, so the id match has to be trusted — otherwise legacy rows never drain.
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["legacy"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["legacy"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'legacy', name: 'Old' }),
            status: 'pending',
        }]);

        await queue.removeMany(testSchema as never, [
            { kind: 'add', entity: { id: 'legacy', name: 'Old' }, revision: 'rev-from-this-session' },
        ]);

        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('settles a legacy row without a revision when the flushed row had one', async () => {
        await writeQueueRows(queueStore, [{
            id: [COLLECTION, 'add', '["legacy"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["legacy"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'legacy', name: 'Old' }),
            status: 'pending',
        }]);

        await queue.removeRows([{
            id: [COLLECTION, 'add', '["legacy"]'].join('\u0000'),
            collectionName: COLLECTION,
            recordIds: '["legacy"]',
            entityJson: '',
            revision: 'rev-from-this-session',
        } as never]);

        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });

    it('stops reporting a collection once its last row is dead', async () => {
        await queue.add(testSchema as never, { id: 'doomed', name: 'Doomed' }, 'add');

        await queue.deadLetter(await readQueueRows(queueStore) as never);

        // Otherwise the background flush keeps waking up for a collection with nothing to send
        expect(await queue.getUnsyncedCollections()).toEqual([]);
        expect(await queue.getPendingCount()).toBe(0);
        expect(await queue.getDeadLetters()).toHaveLength(1);
    });

    it('does not supersede anything when the confirmed change has no seq', async () => {
        const queued: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [queued]);

        // A change reconstructed without a seq (e.g. by older code) may only clear its own row
        await queue.removeMany(testSchema as never, [{ kind: 'update', entity: { id: 'e1', name: 'v2' } }]);

        expect(await readQueueRows(queueStore)).toHaveLength(1);
    });

    it('ignores rows for other collections when superseding', async () => {
        const otherSchema = { ...(testSchema as never as Record<string, unknown>), collectionName: 'otherCollection' };
        await queue.add(otherSchema as never, { id: 'e1', name: 'Elsewhere' }, 'add');

        const confirmed: QueuedChange = { kind: 'remove', entity: { id: 'e1', name: 'Here' } };
        await queue.addMany(testSchema as never, [confirmed]);
        await queue.removeMany(testSchema as never, [confirmed]);

        // Same record ids, different collection: untouched
        const rows = await readQueueRows(queueStore);
        expect(rows).toHaveLength(1);
        expect(rows[0].collectionName).toBe('otherCollection');
    });

    it('settling rows that are already gone is a no-op', async () => {
        const change: QueuedChange = { kind: 'add', entity: { id: 'e1', name: 'v1' } };
        await queue.addMany(testSchema as never, [change]);
        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);

        await queue.removeRows(payload.rows);
        await expect(queue.removeRows(payload.rows)).resolves.toBeUndefined();

        expect(await readQueueRows(queueStore)).toHaveLength(0);
    });
});

describe('UnsyncedQueue when the store misbehaves', () => {
    it('treats a failed store query as an empty queue rather than an error', async () => {
        const queue = new UnsyncedQueue(stubStore({ queryError: new Error('store offline') }));

        expect(await queue.getPendingCount()).toBe(0);
        expect(await queue.getDeadLetters()).toEqual([]);
        expect(await queue.getUnsyncedCollections()).toEqual([]);
        expect(await queue.getUnsyncedIdKeys(COLLECTION)).toEqual(new Set());
        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);
        expect(payload).toEqual(expect.objectContaining({ rows: [], units: [], adds: [], updates: [], removes: [] }));
    });

    it('fails the enqueue when the store cannot persist it', async () => {
        const queue = new UnsyncedQueue(stubStore({ rows: [], persistError: new Error('disk full') }));

        // The caller must learn this: an ack without a durable obligation would be a lie
        await expect(queue.addMany(testSchema as never, [{ kind: 'add', entity: { id: 'a', name: 'A' } }]))
            .rejects.toThrow('disk full');
    });

    it('accepts a store that answers with a single row instead of an array', async () => {
        const row = {
            id: 'row-1',
            collectionName: COLLECTION,
            recordIds: '["solo"]',
            changeKind: 'add',
            entityJson: JSON.stringify({ id: 'solo', name: 'Solo' }),
            status: 'pending',
        };
        const queue = new UnsyncedQueue(stubStore({ rows: row }));

        expect(await queue.getPendingCount()).toBe(1);
        const payload = await queue.getUnsyncedEntitiesForFlush(COLLECTION);
        expect(payload.adds).toEqual([{ id: 'solo', name: 'Solo' }]);
    });

    it('accepts a store that answers with nothing at all', async () => {
        const queue = new UnsyncedQueue(stubStore({ rows: null }));

        expect(await queue.getPendingCount()).toBe(0);
    });

    it('does not read or write the store for empty work', async () => {
        const onPersist = jest.fn();
        const onQuery = jest.fn();
        const queue = new UnsyncedQueue(stubStore({ rows: [], onPersist, onQuery }));

        await expect(queue.addMany(testSchema as never, [])).resolves.toBeUndefined();
        await expect(queue.removeMany(testSchema as never, [])).resolves.toBeUndefined();
        await expect(queue.removeRows([])).resolves.toBeUndefined();
        await expect(queue.recordFailedAttempt([])).resolves.toBeUndefined();
        await expect(queue.deadLetter([])).resolves.toEqual([]);

        expect(onPersist).not.toHaveBeenCalled();
        // Reading the whole queue to settle nothing is the expensive half of the mistake
        expect(onQuery).not.toHaveBeenCalled();
    });

    it('does not write when a dequeue matches no row', async () => {
        const onPersist = jest.fn();
        const queue = new UnsyncedQueue(stubStore({ rows: [], onPersist }));

        await queue.removeMany(testSchema as never, [{ kind: 'add', entity: { id: 'absent', name: 'Absent' } }]);
        await queue.removeRows([{ id: 'absent-row', collectionName: COLLECTION, recordIds: '[]', entityJson: '' } as never]);

        expect(onPersist).not.toHaveBeenCalled();
    });
});

describe('UnsyncedQueue against an insert-only store', () => {
    /**
     * A store with IndexedDB's semantics rather than a Map's: `add` refuses a key that already
     * exists, and only `update` upserts. Dexie behaves exactly this way (bulkAdd throws
     * ConstraintError, bulkPut upserts), and a durable store is the recommended queue backing —
     * so bookkeeping that only works against MemoryPlugin is broken where it matters most.
     */
    function insertOnlyStore() {
        const rows = new Map<string, QueueRow>();

        const plugin: IDbPlugin = {
            query: (event, done) => {
                const value = [...rows.values()];
                done(PluginEventResult.success(event.id, {
                    value,
                    isEmpty: value.length === 0,
                    forEach: (cb: (item: unknown) => void) => value.forEach(cb),
                }) as never);
            },
            bulkPersist: (event, done) => {
                for (const [, changes] of event.operation) {
                    for (const entity of changes.adds as unknown as QueueRow[]) {
                        if (rows.has(entity.id)) {
                            done(PluginEventResult.error(event.id, new Error(`ConstraintError: key ${entity.id} already exists`)) as never);
                            return;
                        }
                        rows.set(entity.id, entity);
                    }
                    for (const update of changes.updates as unknown as Array<{ entity: QueueRow }>) {
                        rows.set(update.entity.id, update.entity);
                    }
                    for (const entity of changes.removes as unknown as QueueRow[]) {
                        rows.delete(entity.id);
                    }
                }
                done(PluginEventResult.success(event.id, new Map()) as never);
            },
            destroy: (event, done) => done(PluginEventResult.success(event.id) as never),
        } as IDbPlugin;

        return { plugin, rows };
    }

    type QueueRow = { id: string; status?: string; attempts?: number; entityJson: string; collectionName: string; recordIds: string; changeKind?: string };

    it('dead-letters a row without re-inserting it', async () => {
        const { plugin, rows } = insertOnlyStore();
        const queue = new UnsyncedQueue(plugin);
        await queue.add(testSchema as never, { id: 'doomed', name: 'Doomed' }, 'add');

        // This is the call that used to fail: the row was rewritten as an add, which an
        // insert-only store rejects, so the change never became dead and retried forever
        const reported = await queue.deadLetter([...rows.values()] as never);

        expect(reported).toHaveLength(1);
        expect([...rows.values()][0].status).toBe('dead');
        expect(await queue.getPendingCount()).toBe(0);
        expect(await queue.getDeadLetters()).toHaveLength(1);
    });

    it('records failed attempts without re-inserting the row', async () => {
        const { plugin, rows } = insertOnlyStore();
        const queue = new UnsyncedQueue(plugin);
        await queue.add(testSchema as never, { id: 'retried', name: 'Retried' }, 'add');

        await queue.recordFailedAttempt([...rows.values()] as never);
        await queue.recordFailedAttempt([...rows.values()] as never);

        expect([...rows.values()][0].attempts).toBe(2);
        expect(await queue.getPendingCount()).toBe(1);
    });

    it('revives a dead row without re-inserting it', async () => {
        const { plugin, rows } = insertOnlyStore();
        const queue = new UnsyncedQueue(plugin);
        await queue.add(testSchema as never, { id: 'revivable', name: 'Revivable' }, 'add');
        await queue.deadLetter([...rows.values()] as never);

        expect(await queue.revive(await queue.getDeadLetters())).toBe(1);

        expect([...rows.values()][0].status).toBe('pending');
        expect(await queue.getPendingCount()).toBe(1);
    });

    it('still enqueues a genuinely new change as an add', async () => {
        const { plugin, rows } = insertOnlyStore();
        const queue = new UnsyncedQueue(plugin);

        await queue.add(testSchema as never, { id: 'fresh', name: 'Fresh' }, 'add');

        expect(rows.size).toBe(1);
        expect([...rows.values()][0].status).toBe('pending');
    });
});

describe('auth error classification', () => {
    it('builds an event from the status an HttpStatusError carries', () => {
        const error = new HttpStatusError(401, 'Unauthorized');

        expect(buildAuthErrorEvent(error, 'query')).toEqual({
            status: 401,
            message: 'HTTP 401: Unauthorized',
            originalError: error,
            context: 'query',
        });
        expect(buildAuthErrorEvent(new HttpStatusError(403, 'Forbidden'), 'bulkPersist')).toEqual(
            expect.objectContaining({ status: 403, context: 'bulkPersist' })
        );
    });

    it('is not an auth event for any other status', () => {
        for (const status of [400, 404, 409, 422, 429, 500, 503]) {
            expect(buildAuthErrorEvent(new HttpStatusError(status, 'Nope'), 'query')).toBeNull();
        }
    });

    it('falls back to the message for an error that lost its type', () => {
        // A plugin that rebuilt the error from a string, or one that crossed a worker boundary
        expect(buildAuthErrorEvent(new Error('HTTP 401: token expired'), 'query')).toEqual(
            expect.objectContaining({ status: 401, message: 'HTTP 401: token expired' })
        );
        expect(buildAuthErrorEvent(new Error('HTTP 403: forbidden'), 'bulkPersist')).toEqual(
            expect.objectContaining({ status: 403 })
        );
        expect(buildAuthErrorEvent('HTTP 401', 'query')).toEqual(
            expect.objectContaining({ status: 401, message: 'HTTP 401' })
        );
    });

    it('is null for a failure that says nothing about auth', () => {
        expect(buildAuthErrorEvent(new Error('socket hang up'), 'query')).toBeNull();
        expect(buildAuthErrorEvent(null, 'query')).toBeNull();
        expect(buildAuthErrorEvent({ status: 401 }, 'query')).toBeNull();
    });
});
