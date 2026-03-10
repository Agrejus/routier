/**
 * Tracks entity IDs that have been written to the SWR store but not yet confirmed by the remote.
 * Used so revalidate does not remove these items from the store on refresh.
 *
 * Uses the store as the single source of truth: add/remove persist to the store;
 * getUnsyncedIdKeys queries the store. If no plugin is provided, uses MemoryPlugin (in-memory only).
 */

import { s } from '@routier/core/schema';
import type { CompiledSchema, InferRoot, InferType } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import type { IDbPlugin, DbPluginQueryEvent, DbPluginBulkPersistEvent } from '@routier/core/plugins';
import { Query } from '@routier/core/plugins';
import { Result } from '@routier/core/results';
import { logger, uuid } from '@routier/core/utilities';

const UNSYNCED_COLLECTION_NAME = '_routier_unsynced' as const;
const ROW_ID_DELIMITER = '\u0000';

function rowId(collectionName: string, recordIdsJson: string): string {
    return `${collectionName}${ROW_ID_DELIMITER}${recordIdsJson}`;
}

const unsyncedQueueSchema = s
    .define(UNSYNCED_COLLECTION_NAME, {
        id: s.string().key().identity(),
        collectionName: s.string(),
        recordIds: s.string(),
        /** JSON-serialized entity so we can reissue the POST without querying the SWR store. */
        entityJson: s.string(),
    })
    .compile();

/** Schema definition root type for the unsynced queue (used by IQuery TRoot). */
type UnsyncedQueueSchemaRoot = InferRoot<typeof unsyncedQueueSchema>;

export type UnsyncedQueueRow = InferType<typeof unsyncedQueueSchema>;

function recordIdsKey(schema: CompiledSchema<Record<string, unknown>>, entity: unknown): string {
    return JSON.stringify(schema.getIds(entity as never));
}

/**
 * Per-collection set of record id keys (JSON.stringify of schema.getIds(entity)) that have been
 * written to the SWR store but not yet confirmed by the remote. The store is the single source
 * of truth; add/remove persist to it, getUnsyncedIdKeys queries it.
 */
export class UnsyncedQueue {
    private readonly store: IDbPlugin;

    constructor(plugin: IDbPlugin) {
        this.store = plugin;
    }

    /**
     * Mark an entity as unsynced (written to SWR store but not yet confirmed by remote).
     * Stores entity JSON so we can reissue the POST without querying the SWR store.
     */
    add<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entity: unknown): void {
        const collectionName = schema.collectionName;
        const key = recordIdsKey(schema as CompiledSchema<Record<string, unknown>>, entity);
        this.persistToStore({ collectionName, adds: [{ recordIds: key, entityJson: JSON.stringify(entity) }], removes: [] });
    }

    /**
     * Remove an entity from the unsynced set (e.g. after remote confirmed or entity removed).
     */
    remove<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entity: unknown): void {
        const collectionName = schema.collectionName;
        const key = recordIdsKey(schema as CompiledSchema<Record<string, unknown>>, entity);
        this.persistToStore({ collectionName, adds: [], removes: [key] });
    }

    /**
     * Add multiple entities as unsynced. Stores entity JSON so we can reissue the POST.
     */
    addMany<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entities: unknown[]): void {
        if (entities.length === 0) return;
        const collectionName = schema.collectionName;
        const schemaAny = schema as CompiledSchema<Record<string, unknown>>;
        const adds = entities.map((e) => ({
            recordIds: recordIdsKey(schemaAny, e),
            entityJson: JSON.stringify(e),
        }));
        this.persistToStore({ collectionName, adds, removes: [] });
    }

    /**
     * Remove multiple entities from the unsynced set. Convenience for bulk persist (after sync or removes).
     */
    removeMany<T extends Record<string, unknown>>(schema: CompiledSchema<T>, entities: unknown[]): void {
        if (entities.length === 0) return;
        const collectionName = schema.collectionName;
        const schemaAny = schema as CompiledSchema<Record<string, unknown>>;
        const removes = entities.map((e) => recordIdsKey(schemaAny, e));
        this.persistToStore({ collectionName, adds: [], removes });
    }

    /**
     * Returns the set of record id keys (JSON.stringify of schema.getIds(entity)) that are unsynced for the collection.
     * Queries the store; use with entityIdKey(schema, entity) to check if an entity is unsynced.
     */
    getUnsyncedIdKeys(collectionName: string): Promise<Set<string>> {
        return new Promise((resolve) => {
            this.queryAll((rows) => {
                const keys = new Set<string>();
                for (const row of rows) {
                    if (row.collectionName === collectionName) keys.add(row.recordIds);
                }
                resolve(keys);
            });
        });
    }

    /**
     * Returns collection names that have at least one unsynced row (for background flush).
     */
    getUnsyncedCollections(): Promise<string[]> {
        return new Promise((resolve) => {
            this.queryAll((rows) => {
                const names = new Set<string>();
                for (const row of rows) names.add(row.collectionName);
                resolve(Array.from(names));
            });
        });
    }

    /**
     * Returns unsynced record id keys and parsed entities for a collection so the plugin can reissue the POST.
     */
    getUnsyncedEntitiesForFlush(collectionName: string): Promise<{ keys: string[]; entities: unknown[] }> {
        return new Promise((resolve) => {
            this.queryAll((rows) => {
                const keys: string[] = [];
                const entities: unknown[] = [];
                for (const row of rows) {
                    if (row.collectionName !== collectionName) continue;
                    keys.push(row.recordIds);
                    try {
                        entities.push(JSON.parse(row.entityJson));
                    } catch {
                        logger.warn('[UnsyncedQueue] failed to parse entityJson', { collectionName, recordIds: row.recordIds });
                    }
                }
                resolve({ keys, entities });
            });
        });
    }

    /**
     * Remove unsynced rows by record id keys (e.g. after POST succeeded). No schema needed.
     */
    removeByKeys(collectionName: string, keys: string[]): void {
        if (keys.length === 0) return;
        this.persistToStore({ collectionName, adds: [], removes: keys });
    }

    private queryAll(cb: (rows: UnsyncedQueueRow[]) => void): void {
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
                cb([]);
                return;
            }
            const data = result.data.value;
            const rows = Array.isArray(data) ? data : data != null ? [data] : [];
            cb(rows);
        });
    }

    private buildSchemas(): SchemaCollection {
        const schemas = new SchemaCollection();
        schemas.set(unsyncedQueueSchema.id, unsyncedQueueSchema);
        return schemas;
    }

    private persistToStore(op: {
        collectionName: string;
        adds: Array<{ recordIds: string; entityJson: string }>;
        removes: string[];
    }): void {
        const { collectionName, adds, removes } = op;
        if (adds.length === 0 && removes.length === 0) return;
        const operation = new BulkPersistChanges();
        const changes = operation.resolve(unsyncedQueueSchema.id);
        const toRow = (add: { recordIds: string; entityJson: string }) => ({
            id: rowId(collectionName, add.recordIds),
            collectionName,
            recordIds: add.recordIds,
            entityJson: add.entityJson,
        });
        changes.adds = adds.map(toRow) as never[];
        changes.removes = removes.map((recordIds) => ({ id: rowId(collectionName, recordIds), collectionName, recordIds, entityJson: '' })) as never[];
        const event: DbPluginBulkPersistEvent = {
            id: uuid(8),
            schemas: this.buildSchemas(),
            source: 'UnsyncedQueue',
            action: 'persist',
            operation,
        };
        this.store.bulkPersist(event, (result) => {
            if (result.ok === Result.ERROR) {
                logger.warn('[UnsyncedQueue] store bulkPersist failed', { error: result.error, event });
            }
        });
    }
}
