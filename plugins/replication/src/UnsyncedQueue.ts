/**
 * Tracks local changes that have been written to the SWR store but not yet confirmed by the remote.
 * Used so revalidate does not clobber these items in the store, and so the background flush can
 * reissue the POST after a failure.
 *
 * Every change kind is tracked — adds, updates AND removes. A remove that never reaches the
 * server would otherwise be resurrected by the next revalidate (the server still returns the
 * row, the store no longer has it, and the diff classifies it as an add).
 *
 * Hardening notes:
 *  - Writes are awaitable: the caller can guarantee the sync obligation is durable before acking.
 *  - Each row carries a `revision` so dequeue is compare-and-delete: confirming an old POST
 *    never deletes a row that was overwritten by a newer local edit mid-flight.
 *  - Each row carries an `opId` (idempotency key) so the server can dedupe replays.
 *  - Rows can be dead-lettered: permanently-failing changes stop blocking the queue, stop
 *    shielding their entity from revalidate, and are reported to the app.
 *
 * Uses the store as the single source of truth: add/remove persist to the store; reads query it.
 */

import { s } from '@routier/core/schema';
import type { CompiledSchema, InferRoot, InferType } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import type { IDbPlugin, DbPluginQueryEvent, DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { logger, uuid, uuidv4 } from '@routier/core/utilities';
import { mergeUpdatePayloads } from './swrUtils';
import { KeyedMutex } from './httpUtils';

const UNSYNCED_COLLECTION_NAME = '_routier_unsynced' as const;
const ROW_ID_DELIMITER = '\u0000';

/**
 * Enqueue order. Rows are keyed by (collection, kind, ids), so one entity can hold up to
 * three rows and nothing about a row says which local change came last. Confirming a change
 * has to retire the older changes it supersedes — and only those — so the order is recorded.
 *
 * Seeded from the clock so a queue reloaded from storage sorts before anything this process
 * enqueues; rows written before the column existed have no seq and count as oldest.
 */
let seqCounter = Date.now();
const nextSeq = (): number => ++seqCounter;

export type QueuedChangeKind = 'add' | 'update' | 'remove';

/** One local change awaiting remote confirmation. */
export type QueuedChange = {
    kind: QueuedChangeKind;
    entity: unknown;
    /** Stamped at enqueue; dequeue only removes rows whose revision still matches. */
    revision?: string;
    /** Idempotency key, stamped at enqueue and sent to the server with every (re)play. */
    opId?: string;
    /** Enqueue order, stamped at enqueue; confirming this change retires older ones. */
    seq?: number;
    /**
     * For updates: the trimmed body to send (key fields + changed fields). `null`/absent means
     * send the whole entity. Computed by the caller, which has the schema and the delta.
     */
    payload?: Record<string, unknown> | null;
};

/** A change the queue has given up on, reported via onSyncDeadLetter. */
export type DeadLetteredChange = {
    collectionName: string;
    kind: QueuedChangeKind;
    entity: unknown;
    opId: string | null;
};

function rowIdOf(collectionName: string, kind: QueuedChangeKind, recordIdsJson: string): string {
    return `${collectionName}${ROW_ID_DELIMITER}${kind}${ROW_ID_DELIMITER}${recordIdsJson}`;
}

const unsyncedQueueSchema = s
    .define(UNSYNCED_COLLECTION_NAME, {
        id: s.string().key().identity(),
        collectionName: s.string(),
        recordIds: s.string(),
        /** 'add' | 'update' | 'remove'. Optional for rows persisted before the column existed; treated as 'add'. */
        changeKind: s.string().optional(),
        /** JSON-serialized entity so we can reissue the POST without querying the SWR store. */
        entityJson: s.string(),
        /** Compare-and-delete token; a newer enqueue of the same row replaces it. Optional for old rows. */
        revision: s.string().optional(),
        /** Idempotency key for server-side replay dedupe. Optional for old rows. */
        opId: s.string().optional(),
        /** 'pending' (default) or 'dead' — dead rows are excluded from flush and from revalidate protection. */
        status: s.string().optional(),
        /** Failed flush attempts, informational. Optional for old rows. */
        attempts: s.number().optional(),
        /** Enqueue order; a confirmed change retires rows for the same entity at or below its seq. */
        seq: s.number().optional(),
        /**
         * For updates: JSON of the trimmed body (ids + changed fields). Absent means the whole
         * entity goes over the wire, which is also what a pre-hardening row means.
         */
        payloadJson: s.string().optional(),
    })
    .compile();

/** Schema definition root type for the unsynced queue (used by IQuery TRoot). */
type UnsyncedQueueSchemaRoot = InferRoot<typeof unsyncedQueueSchema>;

export type UnsyncedQueueRow = InferType<typeof unsyncedQueueSchema>;

/** One coalesced per-entity change: the unit of flush isolation and dead-lettering. */
export interface UnsyncedFlushUnit {
    /** Every queue row this unit settles (winner + superseded rows). */
    rows: UnsyncedQueueRow[];
    kind: QueuedChangeKind;
    /** The full entity. Used for dead-letter reporting, not for the wire. */
    entity: unknown;
    /** What actually goes in the request body — trimmed for updates, the entity otherwise. */
    payload: unknown;
    opId: string | null;
}

/** Grouped unsynced changes for one collection, ready to become a POST body. */
export interface UnsyncedFlushPayload {
    /** The rows behind this payload, used to settle the queue after the POST. */
    rows: UnsyncedQueueRow[];
    /** Per-entity units, used to isolate a poison item when the batch fails permanently. */
    units: UnsyncedFlushUnit[];
    adds: unknown[];
    updates: unknown[];
    removes: unknown[];
    /** Idempotency keys parallel to adds/updates/removes, for the POST meta. */
    opIds: { adds: string[]; updates: string[]; removes: string[] };
}

function recordIdsKey(schema: CompiledSchema<Record<string, unknown>>, entity: unknown): string {
    return JSON.stringify(schema.getIds(entity as never));
}

/** Back-compat: rows persisted before changeKind existed are adds. */
function kindOfRow(row: UnsyncedQueueRow): QueuedChangeKind {
    return row.changeKind === 'update' || row.changeKind === 'remove' ? row.changeKind : 'add';
}

function isDead(row: UnsyncedQueueRow): boolean {
    return row.status === 'dead';
}

/** The trimmed update body a row carries, or null for "send the whole entity". */
function parsePayload(row: UnsyncedQueueRow): Record<string, unknown> | null {
    if (row.payloadJson == null) return null;

    try {
        return JSON.parse(row.payloadJson) as Record<string, unknown>;
    } catch {
        logger.warn('[UnsyncedQueue] failed to parse payloadJson; sending the whole entity', { rowId: row.id });
        return null;
    }
}

/**
 * Collapses every queued row for one entity into the single change to send.
 *
 * The newest row is the local intent, so it decides the entity payload, the kind, and — this
 * part matters — the opId. The idempotency key has to describe the bytes actually sent: borrow
 * an older row's opId and a server that already applied that op will dedupe the replay away,
 * discarding the newer entity riding on it.
 *
 * The one override is that a pending add outranks a pending update for the *kind*: the server
 * has never seen this entity, so an update would address a row that does not exist there.
 * Rows with no seq predate the column and sort oldest.
 */
function coalesceGroup(group: UnsyncedQueueRow[]): { kind: QueuedChangeKind; entity: unknown; payload: unknown; winner: UnsyncedQueueRow } | null {
    const ordered = [...group].sort((a, b) => (a.seq ?? Number.NEGATIVE_INFINITY) - (b.seq ?? Number.NEGATIVE_INFINITY));
    const newest = ordered[ordered.length - 1];
    if (newest == null) return null;

    let entity: unknown;
    try {
        entity = JSON.parse(newest.entityJson);
    } catch {
        return null;
    }

    if (kindOfRow(newest) === 'remove') {
        return { kind: 'remove', entity, payload: entity, winner: newest };
    }

    const hasPendingAdd = ordered.some((r) => kindOfRow(r) === 'add');

    // A pending add means the server has never seen this row, so the whole entity goes — there is
    // nothing there for a partial body to be applied to.
    if (hasPendingAdd) {
        return { kind: 'add', entity, payload: entity, winner: newest };
    }

    return { kind: kindOfRow(newest), entity, payload: parsePayload(newest) ?? entity, winner: newest };
}

/**
 * Per-collection set of local changes (adds/updates/removes) that have been written to the
 * SWR store but not yet confirmed by the remote. The store is the single source of truth;
 * add/remove persist to it, reads query it.
 */
export class UnsyncedQueue {
    private readonly store: IDbPlugin;
    /** Makes read-classify-write queue mutations atomic within this queue instance. */
    private readonly mutationMutex = new KeyedMutex();

    constructor(plugin: IDbPlugin) {
        this.store = plugin;
    }

    /**
     * Mark changes as unsynced (written to SWR store but not yet confirmed by remote).
     * Stamps each change with a revision and an opId (kept on the change object so the
     * caller can later dequeue with compare-and-delete). Resolves when the queue write
     * is durable in the backing store.
     */
    async addMany<T extends Record<string, unknown>>(schema: CompiledSchema<T>, changes: QueuedChange[]): Promise<void> {
        if (changes.length === 0) return;
        const collectionName = schema.collectionName;
        const schemaAny = schema as CompiledSchema<Record<string, unknown>>;

        // A partial update payload has to merge with whatever that row already carries: the row
        // is replaced, so an earlier edit's fields would otherwise never reach the server.
        const existingPayloads = changes.some((c) => c.kind === 'update' && c.payload != null)
            ? await this.payloadsByRowId(collectionName)
            : new Map<string, Record<string, unknown> | null>();

        const adds = changes.map((c) => {
            c.revision = c.revision ?? uuidv4();
            c.opId = c.opId ?? uuidv4();
            c.seq = c.seq ?? nextSeq();

            const recordIds = recordIdsKey(schemaAny, c.entity);
            const rowId = rowIdOf(collectionName, c.kind, recordIds);
            const payload = c.kind === 'update' && existingPayloads.has(rowId)
                ? mergeUpdatePayloads(existingPayloads.get(rowId) ?? null, c.payload ?? null)
                : c.payload ?? null;

            return {
                recordIds,
                changeKind: c.kind,
                entityJson: JSON.stringify(c.entity),
                revision: c.revision,
                opId: c.opId,
                seq: c.seq,
                payloadJson: payload == null ? undefined : JSON.stringify(payload),
            };
        });

        return this.persistToStore({ collectionName, adds, removeRowIds: [] });
    }

    /**
     * Current update payloads for a collection, by row id. A row present with `null` means it is
     * already carrying a whole-entity update, which absorbs any partial merged into it.
     */
    private async payloadsByRowId(collectionName: string): Promise<Map<string, Record<string, unknown> | null>> {
        const byRowId = new Map<string, Record<string, unknown> | null>();

        for (const row of await this.allRows()) {
            if (row.collectionName !== collectionName || kindOfRow(row) !== 'update') continue;
            byRowId.set(row.id, parsePayload(row));
        }

        return byRowId;
    }

    /**
     * Remove changes from the unsynced set after the remote confirmed them.
     *
     * Two rules, and the queue is only safe with both:
     *
     *  - **Compare-and-delete.** A row is removed only while its revision still matches the
     *    change that was confirmed, so a newer local edit that overwrote the row mid-POST
     *    stays queued.
     *  - **Supersede older changes for the same entity.** A confirmed change also retires the
     *    entity's *other* queued rows that were enqueued no later than it (rows are keyed by
     *    kind, so an add, an update and a remove of one entity are three separate rows).
     *    Without this a confirmed remove leaves the earlier add queued, the next flush replays
     *    it, and the row the caller deleted comes back from the dead. Rows enqueued *after*
     *    the confirmed change are newer local intent and stay.
     */
    async removeMany<T extends Record<string, unknown>>(schema: CompiledSchema<T>, changes: QueuedChange[]): Promise<void> {
        if (changes.length === 0) return;
        const collectionName = schema.collectionName;
        const schemaAny = schema as CompiledSchema<Record<string, unknown>>;

        const wanted = new Map<string, QueuedChange>();
        /** Newest confirmed seq per entity: everything at or below it is obsolete. */
        const confirmedSeqByEntity = new Map<string, number>();

        for (const c of changes) {
            const recordIds = recordIdsKey(schemaAny, c.entity);
            wanted.set(rowIdOf(collectionName, c.kind, recordIds), c);

            if (c.seq != null) {
                confirmedSeqByEntity.set(recordIds, Math.max(confirmedSeqByEntity.get(recordIds) ?? c.seq, c.seq));
            }
        }

        const rows = await this.allRows();
        const removeRowIds: string[] = [];

        for (const row of rows) {
            const change = wanted.get(row.id);

            if (change != null) {
                // No revision on either side (old rows / untracked changes) → trust the id match
                if (change.revision != null && row.revision != null && change.revision !== row.revision) {
                    logger.debug('[UnsyncedQueue] skip dequeue; row was overwritten by a newer local edit', { rowId: row.id });
                    continue;
                }
                removeRowIds.push(row.id);
                continue;
            }

            if (row.collectionName !== collectionName) continue;

            const confirmedSeq = confirmedSeqByEntity.get(row.recordIds);
            if (confirmedSeq == null) continue;

            // A row with no seq predates the column, so it cannot be newer than the change
            if ((row.seq ?? Number.NEGATIVE_INFINITY) <= confirmedSeq) {
                logger.debug('[UnsyncedQueue] retiring a change superseded by a confirmed one', { rowId: row.id });
                removeRowIds.push(row.id);
            }
        }

        return this.persistToStore({ collectionName, adds: [], removeRowIds });
    }

    /** Single-change conveniences. */
    add<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entity: unknown, kind: QueuedChangeKind = 'add'): Promise<void> {
        return this.addMany(schema, [{ kind, entity }]);
    }

    remove<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entity: unknown, kind: QueuedChangeKind = 'add'): Promise<void> {
        return this.removeMany(schema, [{ kind, entity }]);
    }

    /**
     * Returns the set of record id keys (JSON.stringify of schema.getIds(entity)) that have a
     * PENDING unsynced change for the collection. Revalidate uses this to keep local changes
     * authoritative until the remote confirms them. Dead rows are excluded — once the queue
     * has given up on a change, the server copy wins again.
     */
    getUnsyncedIdKeys(collectionName: string): Promise<Set<string>> {
        return this.allRows().then((rows) => {
            const keys = new Set<string>();
            for (const row of rows) {
                if (row.collectionName === collectionName && !isDead(row)) keys.add(row.recordIds);
            }
            return keys;
        });
    }

    /**
     * Returns collection names that have at least one pending unsynced row (for background flush).
     */
    getUnsyncedCollections(): Promise<string[]> {
        return this.allRows().then((rows) => {
            const names = new Set<string>();
            for (const row of rows) {
                if (!isDead(row)) names.add(row.collectionName);
            }
            return Array.from(names);
        });
    }

    /** Pending row count across all collections (observability). */
    getPendingCount(): Promise<number> {
        return this.allRows().then((rows) => rows.filter((r) => !isDead(r)).length);
    }

    /** Dead-lettered rows (observability / manual recovery). */
    getDeadLetters(): Promise<UnsyncedQueueRow[]> {
        return this.allRows().then((rows) => rows.filter(isDead));
    }

    /**
     * Returns pending unsynced changes for a collection grouped by kind, coalesced per
     * entity: a remove supersedes a pending add/update of the same entity (the server
     * either never saw the add — the remove is then a no-op server-side — or it did,
     * and the remove is exactly right). All superseded rows still ride along in `rows`
     * so a successful POST clears them.
     */
    getUnsyncedEntitiesForFlush(collectionName: string): Promise<UnsyncedFlushPayload> {
        return this.allRows().then((rows) => {
            const byEntity = new Map<string, UnsyncedQueueRow[]>();
            for (const row of rows) {
                if (row.collectionName !== collectionName || isDead(row)) continue;
                const group = byEntity.get(row.recordIds) ?? [];
                group.push(row);
                byEntity.set(row.recordIds, group);
            }

            const payload: UnsyncedFlushPayload = {
                rows: [],
                units: [],
                adds: [],
                updates: [],
                removes: [],
                opIds: { adds: [], updates: [], removes: [] },
            };

            for (const group of byEntity.values()) {
                const coalesced = coalesceGroup(group);
                if (coalesced == null) {
                    logger.warn('[UnsyncedQueue] failed to parse entityJson', { collectionName, recordIds: group[0]?.recordIds });
                    continue;
                }

                const { kind, entity, payload: wirePayload, winner } = coalesced;
                const unit: UnsyncedFlushUnit = { rows: group, kind, entity, payload: wirePayload, opId: winner.opId ?? null };
                payload.units.push(unit);
                payload.rows.push(...group);

                if (kind === 'add') {
                    payload.adds.push(unit.payload);
                    payload.opIds.adds.push(unit.opId ?? '');
                } else if (kind === 'update') {
                    payload.updates.push(unit.payload);
                    payload.opIds.updates.push(unit.opId ?? '');
                } else {
                    payload.removes.push(unit.payload);
                    payload.opIds.removes.push(unit.opId ?? '');
                }
            }

            return payload;
        });
    }

    /**
     * Settles flushed rows (POST succeeded). No schema needed — the rows carry everything.
     * Compare-and-delete like removeMany: a row whose revision changed since the flush read
     * it is a newer local edit that still needs to go out, so it stays.
     */
    async removeRows(rows: UnsyncedQueueRow[]): Promise<void> {
        if (rows.length === 0) return;

        const flushedRevisions = new Map<string, string | undefined>();
        for (const row of rows) {
            flushedRevisions.set(row.id, row.revision);
        }

        const current = await this.allRows();
        const removeRowIds: string[] = [];

        for (const row of current) {
            if (!flushedRevisions.has(row.id)) continue;

            const flushedRevision = flushedRevisions.get(row.id);
            if (flushedRevision != null && row.revision != null && flushedRevision !== row.revision) {
                logger.debug('[UnsyncedQueue] skip dequeue; row was overwritten while flushing', { rowId: row.id });
                continue;
            }
            removeRowIds.push(row.id);
        }

        return this.persistToStore({ collectionName: '', adds: [], removeRowIds });
    }

    /**
     * Dead-letters rows: they stop flushing, stop shielding their entities from
     * revalidate, and are returned so the plugin can report them to the app.
     */
    async deadLetter(rows: UnsyncedQueueRow[]): Promise<DeadLetteredChange[]> {
        if (rows.length === 0) return [];

        await this.persistToStore({
            collectionName: '',
            adds: [],
            removeRowIds: [],
            replacements: rows.map((row) => ({ ...row, status: 'dead' })),
        });

        return rows.map((row) => {
            let entity: unknown = null;
            try { entity = JSON.parse(row.entityJson); } catch { /* reported as null */ }
            return {
                collectionName: row.collectionName,
                kind: kindOfRow(row),
                entity,
                opId: row.opId ?? null,
            };
        });
    }

    /**
     * Returns dead-lettered rows to the pending set so the next flush tries them again.
     *
     * Dead-lettering is the queue giving up, and it is deliberately one-way: the server said
     * no in a way that retrying cannot fix. Something outside the queue has to have changed
     * for a retry to make sense — the user fixed the record, a deploy fixed the validation, an
     * operator is retrying by hand — so this is an explicit call, never automatic.
     *
     * Attempts reset to 0: the count describes this new run, not the failed one.
     */
    async revive(rows: UnsyncedQueueRow[]): Promise<number> {
        const dead = rows.filter(isDead);
        if (dead.length === 0) return 0;

        await this.persistToStore({
            collectionName: '',
            adds: [],
            removeRowIds: [],
            replacements: dead.map((row) => ({ ...row, status: 'pending', attempts: 0 })),
        });

        return dead.length;
    }

    /** Bumps the informational attempt counter on rows after a failed flush. */
    recordFailedAttempt(rows: UnsyncedQueueRow[]): Promise<void> {
        if (rows.length === 0) return Promise.resolve();
        return this.persistToStore({
            collectionName: '',
            adds: [],
            removeRowIds: [],
            replacements: rows.map((row) => ({ ...row, attempts: (row.attempts ?? 0) + 1 })),
        });
    }

    private allRows(): Promise<UnsyncedQueueRow[]> {
        return new Promise((resolve) => {
            const schemas = new SchemaCollection();
            schemas.set(unsyncedQueueSchema.id, unsyncedQueueSchema);
            const operation = Query.EMPTY<UnsyncedQueueSchemaRoot, UnsyncedQueueRow>(unsyncedQueueSchema);
            const event: DbPluginQueryEvent<UnsyncedQueueSchemaRoot, UnsyncedQueueRow> = {
                id: uuid(8),
                schemas,
                source: 'UnsyncedQueue',
                action: 'query',
                operation,
            };
            this.store.query(event, (result) => {
                if (result.ok === Result.ERROR) {
                    logger.warn('[UnsyncedQueue] store query failed', { error: result.error });
                    resolve([]);
                    return;
                }
                const data = result.data.value;
                resolve(Array.isArray(data) ? data : data != null ? [data] : []);
            });
        });
    }

    private buildSchemas(): SchemaCollection {
        const schemas = new SchemaCollection();
        schemas.set(unsyncedQueueSchema.id, unsyncedQueueSchema);
        return schemas;
    }

    private persistToStore(op: {
        collectionName: string;
        adds: Array<{ recordIds: string; changeKind: QueuedChangeKind; entityJson: string; revision: string; opId: string; seq: number; payloadJson?: string }>;
        removeRowIds: string[];
        /** Full-row overwrites (dead-letter, attempt bumps); re-added by id. */
        replacements?: UnsyncedQueueRow[];
    }): Promise<void> {
        if (op.adds.length === 0 && op.removeRowIds.length === 0 && (op.replacements?.length ?? 0) === 0) {
            return Promise.resolve();
        }

        return this.mutationMutex.run('queue', () => this.persistToStoreLocked(op));
    }

    private async persistToStoreLocked(op: {
        collectionName: string;
        adds: Array<{ recordIds: string; changeKind: QueuedChangeKind; entityJson: string; revision: string; opId: string; seq: number; payloadJson?: string }>;
        removeRowIds: string[];
        replacements?: UnsyncedQueueRow[];
    }): Promise<void> {
        const { collectionName, adds, removeRowIds, replacements = [] } = op;
        const existingIds = adds.length === 0
            ? new Set<string>()
            : new Set((await this.allRows()).map((row) => row.id));

        // Keep only the newest candidate for a repeated (collection, kind, entity) key in this
        // call. Durable stores reject duplicate inserts even when an in-memory store upserts.
        const candidatesById = new Map<string, UnsyncedQueueRow>();
        for (const add of adds) {
            const id = rowIdOf(collectionName, add.changeKind, add.recordIds);
            candidatesById.set(id, {
                id,
                collectionName,
                recordIds: add.recordIds,
                changeKind: add.changeKind,
                entityJson: add.entityJson,
                revision: add.revision,
                opId: add.opId,
                status: 'pending',
                attempts: 0,
                seq: add.seq,
                payloadJson: add.payloadJson,
            });
        }
        const candidates = [...candidatesById.values()];

        const operation = new BulkPersistChanges();
        const changes = operation.resolve(unsyncedQueueSchema.id);
        changes.adds = candidates.filter((row) => !existingIds.has(row.id)) as never[];
        const overwritten = candidates.filter((row) => existingIds.has(row.id));
        // Replacements (dead-letter, attempt bumps) and re-enqueues go out as UPDATES, not adds.
        //
        // They used to ride as adds, which worked only because MemoryDataCollection.add is an
        // upsert. A durable store — the one you actually want here, so unsynced writes survive
        // a refresh — is insert-only on add: Dexie's bulkAdd throws on an existing key, so
        // dead-lettering silently did nothing and a permanently-rejected change retried forever.
        // Every plugin upserts on update (Dexie via bulkPut), and "modify an existing row" is
        // what this is.
        changes.updates = [...overwritten, ...replacements].map((entity) => ({
            entity,
            changeType: 'markedDirty' as const,
            delta: {},
        })) as never[];
        changes.removes = removeRowIds.map((id) => ({ id, collectionName, recordIds: '', changeKind: 'add', entityJson: '' })) as never[];

        const event: DbPluginBulkPersistEvent = {
            id: uuid(8),
            schemas: this.buildSchemas(),
            source: 'UnsyncedQueue',
            action: 'persist',
            operation,
        };

        return new Promise((resolve, reject) => {
            this.store.bulkPersist(event, (result) => {
                if (result.ok === Result.ERROR) {
                    logger.warn('[UnsyncedQueue] store bulkPersist failed', { error: result.error, event });
                    reject(result.error);
                    return;
                }
                resolve();
            });
        });
    }
}
