import { DataStore } from "./DataStore";
import { CompiledSchema, HashType, InferCreateType, InferType, SchemaId, s } from "@routier/core/schema";
import { CallbackPartialResult, CallbackResult, Result, toPromise } from "@routier/core/results";
import { BulkPersistChanges, BulkPersistResult, SchemaPersistResult } from "@routier/core/collections";
import { logger, UnknownRecord, uuid } from "@routier/core/utilities";
import { assertIsNotNull } from "@routier/core/assertions";
import { IDbPlugin } from "@routier/core/plugins";
import { RecordIdsBuilder, QueueEntryMatcher, ChangePayloadBuilder, SYNC_CONSTANTS } from "./utils";
import { Queryable } from "./queryable/Queryable";

const queueSchema = s.define("__pending_changes__", {
    id: s.string().key(),
    schemaId: s.number(), // Client uses schemaId, server uses tableName
    // recordIds is stored as an object containing the key properties
    // For single keys: { id: "value" } or { userId: "value" } (depending on schema)
    // For composite keys: { key1: "value1", key2: "value2", ... }
    // The schema's idProperties will tell us which properties to extract
    recordIds: s.object<{ [property: string]: string | number }>({}),
    timestamp: s.number(),
    changeType: s.string().constrain<'add' | 'update' | 'remove'>(),
    status: s.string().constrain<'pending' | 'synced'>(),
    entityData: s.object({}).optional(), // Client-only: Store entity data for retries/conflict resolution
    retryCount: s.number().optional(), // Client-only: Track retry attempts for offline scenarios
}).compile();

// Use InferType to derive type from schema (Routier best practice)
export type QueueEntry = InferType<typeof queueSchema>;

/**
 * Reusable query composer for pending changes by schemaId
 * Uses Queryable.compose() to create a parameterized query that can be reused
 */
const createPendingQueueEntriesQuery = (schemaId: SchemaId) =>
    Queryable.compose(queueSchema)
        .where(([q, p]) => q.schemaId === p.schemaId, { schemaId })
        .where(([q, p]) => q.status === p.status, { status: 'pending' });

// Helper to create pending change entries - reduces code duplication
// Builds recordIds object from entity using schema's idProperties
const createQueueEntry = (
    schemaId: SchemaId,
    schema: CompiledSchema<UnknownRecord>,
    entity: UnknownRecord,
    changeType: 'add' | 'update' | 'remove',
    entityData: UnknownRecord
): InferCreateType<typeof queueSchema> => {
    // Use single timestamp for all pending changes in this batch (better for ordering)
    const timestamp = Date.now();

    // Build recordIds object with all key properties from the schema
    const recordIds = RecordIdsBuilder.buildFromEntity(schema, entity);

    return queueSchema.prepare({
        id: uuid(8),
        schemaId,
        recordIds: recordIds as any,
        timestamp,
        changeType,
        status: 'pending',
        entityData,
    });
};

export interface SyncDataStoreOptions {
    /**
     * Base URL of the sync server (e.g., "http://localhost:3000")
     * Required for SSE connections and sync operations
     */
    serverBaseUrl: string;
    /**
     * Client ID to send with requests
     * Can be used for multi-tenant scenarios
     */
    clientId: string;
}

export abstract class SyncDataStore extends DataStore {
    /**
     * Pending changes collection - tracks local changes to push to server and sync checkpoints
     * This is client-only and should never be synced to the server
     * The queue is the source of truth - we derive lastSyncTimestamp from it
     */
    private queueCollection = this.collection(queueSchema).create();

    /**
     * Server configuration options
     */
    protected readonly syncOptions: SyncDataStoreOptions;

    /**
     * Constructs a new SyncDataStore instance.
     * @param dbPlugin The database plugin to use for persistence.
     * @param options Server configuration for sync operations.
     */
    constructor(dbPlugin: IDbPlugin, options: SyncDataStoreOptions) {
        super(dbPlugin);
        this.syncOptions = options;
    }

    sync(done: CallbackResult<void>) {
        let completed = 0;
        let hasError = false;
        const totalSchemas = this.schemas.size;

        if (totalSchemas === 0) {
            logger.log("[SYNC] No schemas to sync, skipping");
            return done(Result.success());
        }

        logger.log(`[SYNC] Starting sync for ${totalSchemas} schema(s)`);

        const syncSchema = async (schema: CompiledSchema<UnknownRecord>) => {
            try {
                logger.log(`[SYNC] Syncing schema: ${schema.collectionName} (id: ${schema.id})`);

                // Get last sync timestamp from queue (source of truth)
                const sinceTimestamp = await this.getLastSyncTimestampAsync(schema.id);
                logger.log(`[SYNC] Last sync timestamp for ${schema.collectionName}: ${sinceTimestamp ?? 'never'}`);

                logger.log(`[SYNC] Fetching remote data for ${schema.collectionName} since timestamp ${sinceTimestamp ?? 'initial'}`);
                const fetchResult = await toPromise<{ data: UnknownRecord[], serverTimestamp: number }>(done =>
                    this.fetchRemoteData(schema, sinceTimestamp, done)
                );

                logger.log(`[SYNC] Fetched ${fetchResult.data.length} record(s) from server for ${schema.collectionName}, serverTimestamp: ${fetchResult.serverTimestamp}`);
                await this.atomicSyncRemoteDataAsync(schema, fetchResult.data, fetchResult.serverTimestamp);
                logger.log(`[SYNC] Successfully synced ${schema.collectionName}`);
            } catch (error) {
                hasError = true;
                logger.error(`[SYNC] Error syncing remote data for schema ${schema.collectionName} (id: ${schema.id})`, error);
            } finally {
                completed++;
                if (completed === totalSchemas) {
                    if (hasError) {
                        logger.error(`[SYNC] Sync completed with errors for ${completed}/${totalSchemas} schema(s)`);
                    } else {
                        logger.log(`[SYNC] Sync completed successfully for all ${totalSchemas} schema(s)`);
                    }
                    done(hasError ? Result.error("One or more sync operations failed") : Result.success());
                }
            }
        };

        // Filter out internal pending changes schema - it should not be synced to server
        const schemasToSync = Array.from(this.schemas.entries())
            .filter(([, schema]) => schema.collectionName !== queueSchema.collectionName);

        for (const [, schema] of schemasToSync) {
            syncSchema(schema);
        }
    }

    async syncAsync(): Promise<void> {
        return toPromise(w => this.sync(w));
    }

    private toMap<T extends {}>(schema: CompiledSchema<T>, data: T[]): Map<string, string> {
        const result = new Map<string, string>();

        for (let i = 0, length = data.length; i < length; i++) {
            const key = schema.hash(data[i] as InferType<T>, HashType.Ids);
            const value = schema.hash(data[i] as InferCreateType<T>, HashType.Object);
            result.set(key, value);
        }

        return result;
    }

    private toEntityMap<T extends {}>(schema: CompiledSchema<T>, data: T[]): Map<string, InferType<T>> {
        const result = new Map<string, InferType<T>>();

        for (let i = 0, length = data.length; i < length; i++) {
            const entity = data[i] as InferType<T>;
            const key = schema.hash(entity, HashType.Ids);
            result.set(key, entity);
        }

        return result;
    }

    /**
     * Get the last sync timestamp for a schema by querying the pending changes collection
     * Returns the maximum timestamp from entries with special recordIds { __sync__: true }
     * These entries track when we successfully fetched from the server
     * The pending changes collection is the source of truth - we derive lastSyncTimestamp from it
     */
    protected async getLastSyncTimestampAsync(schemaId: SchemaId): Promise<number | null> {
        const latestSyncEntry = await this.queueCollection
            .where(([q, p]) => {
                const recordIds = q.recordIds as UnknownRecord;
                return q.schemaId === p.schemaId && recordIds[p.syncMarker] === true;
            }, { schemaId, syncMarker: SYNC_CONSTANTS.SYNC_MARKER })
            .sortDescending((q) => q.timestamp)
            .firstOrUndefinedAsync();

        const timestamp = latestSyncEntry?.timestamp ?? null;
        if (timestamp) {
            logger.log(`[SYNC] Found last sync timestamp for schema ${schemaId}: ${timestamp}`);
        } else {
            logger.log(`[SYNC] No previous sync found for schema ${schemaId}, will perform initial sync`);
        }
        return timestamp;
    }

    // Removed queueLocalChange - pending changes are now created directly in saveChanges override
    // This simplifies the design and ensures atomic operations

    /**
     * Handles sync errors by incrementing retry counts for matching pending changes
     */
    private async handleSyncError(
        schemaId: SchemaId,
        idProperties: Array<{ name: string }>,
        pendingChanges: QueueEntry[]
    ): Promise<void> {
        const queueEntries = await this.queueCollection
            .apply(createPendingQueueEntriesQuery(schemaId))
            .toArrayAsync();

        const matchingEntries = QueueEntryMatcher.findMatchingEntries(idProperties, queueEntries, pendingChanges);

        for (const entry of matchingEntries) {
            const newRetryCount = (entry.retryCount ?? 0) + 1;
            entry.retryCount = newRetryCount;
            const recordIds = entry.recordIds as UnknownRecord;
            const firstKeyValue = RecordIdsBuilder.extractFirstKeyValue(idProperties, recordIds);
            logger.log(`[SYNC] Incremented retry count for record ${firstKeyValue} to ${newRetryCount}`);
            // Keep status as 'pending' even after max retries - allows manual inspection/retry
        }

        await this.saveChangesAsync();
    }

    /**
     * Marks pending changes as synced after successful send to server
     * Note: We do NOT update lastSyncTimestamp here - that should only be updated when fetching FROM server
     */
    private async markQueueEntriesSynced(
        schemaId: SchemaId,
        idProperties: Array<{ name: string }>,
        pendingChanges: QueueEntry[],
        collectionName: string
    ): Promise<void> {
        const queueEntries = await this.queueCollection
            .apply(createPendingQueueEntriesQuery(schemaId))
            .toArrayAsync();

        const matchingEntries = QueueEntryMatcher.findMatchingEntries(idProperties, queueEntries, pendingChanges);

        for (const entry of matchingEntries) {
            entry.status = 'synced';
        }

        await this.saveChangesAsync();
        logger.log(`[SYNC] Marked ${matchingEntries.length} pending change(s) as synced for ${collectionName}`);
    }

    protected async processQueuedChangesAsync(schemaId: SchemaId): Promise<void> {
        const pendingChanges = await this.queueCollection
            .apply(createPendingQueueEntriesQuery(schemaId))
            .toArrayAsync();

        if (pendingChanges.length === 0) {
            logger.log(`[SYNC] No pending changes to send for schema ${schemaId}`);
            return;
        }

        const schema = this._schemas.get(schemaId);
        if (!schema) {
            logger.error(`[SYNC] Schema not found: ${schemaId}`);
            throw new Error(`Schema not found: ${schemaId}`);
        }

        // Count changes by type
        const adds = pendingChanges.filter(p => p.changeType === 'add').length;
        const updates = pendingChanges.filter(p => p.changeType === 'update').length;
        const removes = pendingChanges.filter(p => p.changeType === 'remove').length;
        logger.log(`[SYNC] Processing ${pendingChanges.length} pending change(s) for ${schema.collectionName}: ${adds} add(s), ${updates} update(s), ${removes} remove(s)`);

        // Build change payloads from pending changes
        const idProperties = schema.idProperties;
        const changes = ChangePayloadBuilder.buildChangePayloads(idProperties, pendingChanges);

        let serverTimestamp: number;
        try {
            logger.log(`[SYNC] Sending ${pendingChanges.length} change(s) to server for ${schema.collectionName}`);
            const sendResult = await toPromise<{ serverTimestamp: number }>(done =>
                this.sendQueuedChangesToRemote(schema, changes, done)
            );
            serverTimestamp = sendResult.serverTimestamp;
            logger.log(`[SYNC] Successfully sent changes to server for ${schema.collectionName}, serverTimestamp: ${serverTimestamp}`);
        } catch (error) {
            // On error, update retry count but keep status as 'pending' for retry
            logger.error(`[SYNC] Failed to send changes to server for ${schema.collectionName}, incrementing retry count`, error);
            await this.handleSyncError(schemaId, idProperties, pendingChanges);
            throw error;
        }

        // Atomic operation: Mark pending changes as synced after successful send
        // Note: We do NOT update lastSyncTimestamp here - that should only be updated when fetching FROM server
        // The serverTimestamp from sending is not the same as the last fetch timestamp
        // Mark as 'synced' to indicate these changes have been successfully sent to the server
        await this.markQueueEntriesSynced(schemaId, idProperties, pendingChanges, schema.collectionName);
    }

    protected processQueuedChanges(
        schemaId: SchemaId,
        done: CallbackResult<void>
    ): void {
        this.processQueuedChangesAsync(schemaId)
            .then(() => done(Result.success()))
            .catch(error => done(Result.error(error)));
    }

    private async atomicSyncRemoteDataAsync<T>(
        schema: CompiledSchema<T>,
        remoteData: T[],
        serverTimestamp: number
    ): Promise<void> {
        const collection = this.collections.get(schema.id);
        if (!collection) {
            logger.error(`[SYNC] Collection not found for schema: ${schema.collectionName}`);
            throw new Error(`Collection not found for schema: ${schema.collectionName}`);
        }

        logger.log(`[SYNC] Calculating changes for ${schema.collectionName} (remote: ${remoteData.length} record(s))`);
        const { adds, updates, removals } = await this.calculateChangesAsync(schema, remoteData);
        logger.log(`[SYNC] Calculated changes for ${schema.collectionName}: ${adds.length} add(s), ${updates.length} update(s), ${removals.length} removal(s)`);

        const bulkChanges = new BulkPersistChanges();

        const schemaChanges = bulkChanges.resolve(schema.id);
        schemaChanges.adds = adds;
        schemaChanges.updates = updates.map(u => ({
            entity: u.remote,
            changeType: "markedDirty" as const,
            delta: {}
        }));
        schemaChanges.removes = removals;

        // Add sync event to pending changes atomically - tracks when we successfully fetched from server
        // Uses special recordIds { __sync__: true } to mark sync events
        // The pending changes collection is the source of truth - we derive lastSyncTimestamp from it
        const queueChanges = bulkChanges.resolve(queueSchema.id);
        const syncEntry = queueSchema.prepare({
            id: uuid(8),
            schemaId: schema.id,
            recordIds: { [SYNC_CONSTANTS.SYNC_MARKER]: true } as any, // Special marker for sync events
            timestamp: serverTimestamp,
            changeType: 'add', // Use regular changeType, special recordIds marks it as sync event
            status: 'synced', // Sync events are immediately synced
        });
        queueChanges.adds = [syncEntry as unknown as typeof queueChanges.adds[number]];

        logger.log(`[SYNC] Persisting changes atomically for ${schema.collectionName} (including sync timestamp: ${serverTimestamp})`);
        await new Promise<void>((resolve, reject) => {
            this.dbPlugin.bulkPersist({
                id: uuid(8),
                operation: bulkChanges,
                schemas: this._schemas,
                source: "SyncDataStore",
                action: "persist"
            }, (result) => {
                if (result.ok === Result.ERROR) {
                    logger.error(`[SYNC] Failed to persist changes for ${schema.collectionName}`, result.error);
                    reject(result.error);
                } else {
                    logger.log(`[SYNC] Successfully persisted changes for ${schema.collectionName}`);
                    resolve();
                }
            });
        });
    }

    private async calculateChangesAsync<T>(
        schema: CompiledSchema<T>,
        remoteData: T[]
    ): Promise<{
        adds: InferCreateType<UnknownRecord>[];
        updates: Array<{ local: InferType<UnknownRecord>, remote: InferType<UnknownRecord> }>;
        removals: InferType<UnknownRecord>[];
    }> {
        const collection = this.collections.get(schema.id);
        if (!collection) {
            return {
                adds: remoteData as InferType<UnknownRecord>[],
                updates: [],
                removals: []
            };
        }

        const localData = await collection.toArrayAsync() as T[];
        const hashedCollectionData = this.toMap(schema, localData);
        const entityMap = this.toEntityMap(schema, localData);
        const remoteEntityIdHashes = new Set<string>();
        const adds: InferCreateType<UnknownRecord>[] = [];
        const updates: Array<{ local: InferType<UnknownRecord>, remote: InferType<UnknownRecord> }> = [];

        for (let i = 0, length = remoteData.length; i < length; i++) {
            const remoteEntity = remoteData[i] as InferType<T>;
            const hashedEntityIds = schema.hash(remoteEntity, HashType.Ids);
            remoteEntityIdHashes.add(hashedEntityIds);

            const hashedLocalEntity = hashedCollectionData.get(hashedEntityIds);

            if (hashedLocalEntity == null) {
                adds.push(remoteEntity as InferCreateType<UnknownRecord>);
                continue;
            }

            const hashedRemoteEntity = schema.hash(remoteEntity as InferCreateType<T>, HashType.Object);

            if (hashedRemoteEntity !== hashedLocalEntity) {
                const localEntity = entityMap.get(hashedEntityIds) as InferType<UnknownRecord>;
                if (localEntity) {
                    updates.push({ local: localEntity, remote: remoteEntity as InferType<UnknownRecord> });
                }
            }
        }

        const removals: InferType<UnknownRecord>[] = [];
        for (let i = 0, length = localData.length; i < length; i++) {
            const localEntity = localData[i] as InferType<UnknownRecord>;
            const hashedEntityIds = schema.hash(localEntity as InferType<T>, HashType.Ids);

            if (!remoteEntityIdHashes.has(hashedEntityIds)) {
                removals.push(localEntity);
            }
        }

        return { adds, updates, removals };
    }

    private sendQueuedChangesToRemote<T>(
        schema: CompiledSchema<T>,
        changes: Array<{ type: string, entityId: string, entity?: UnknownRecord, localTimestamp: number }>,
        done: CallbackResult<{ serverTimestamp: number }>
    ): void {
        const adds = changes.filter(c => c.type === 'add').map(c => c.entity).filter(Boolean);
        const updates = changes.filter(c => c.type === 'update').map(c => c.entity).filter(Boolean);
        const removes = changes.filter(c => c.type === 'remove').map(c => ({ id: c.entityId })).filter(Boolean);

        logger.log(`[SYNC] Sending to remote for ${schema.collectionName}: ${adds.length} add(s), ${updates.length} update(s) (with delta), ${removes.length} remove(s)`);

        this.sendChangesToRemote(schema, {
            adds,
            updates,
            removes
        } as SchemaPersistResult<T>, (result) => {
            if (result.ok === Result.ERROR) {
                logger.error(`[SYNC] Failed to send changes to remote for ${schema.collectionName}`, result.error);
                return done(result);
            }
            logger.log(`[SYNC] Successfully sent changes to remote for ${schema.collectionName}, received serverTimestamp: ${result.data.serverTimestamp}`);
            done(Result.success({ serverTimestamp: result.data.serverTimestamp }));
        });
    }

    // Fetches data from the remote server (client-initiated pull)
    // sinceTimestamp: Client's last known server timestamp (null for initial sync)
    // Returns: { data: T[], serverTimestamp: number }
    abstract fetchRemoteData<T extends {}>(
        schema: CompiledSchema<T>,
        sinceTimestamp: number | null,
        done: CallbackResult<{ data: T[], serverTimestamp: number }>
    ): void;

    // Sends queued changes to remote and receives server timestamp
    abstract sendChangesToRemote<T extends {}>(
        schema: CompiledSchema<T>,
        data: SchemaPersistResult<T>,
        done: CallbackResult<{ serverTimestamp: number }>
    ): void;

    /**
     * Handles incoming data pushed from the server (SSE/long polling)
     * This is called when the server pushes changes via SSE or other push mechanism
     * Concrete implementations should connect to SSE endpoint and call this method when data arrives
     */
    abstract handleIncomingData<T extends {}>(schema: CompiledSchema<T>, done: CallbackResult<T[]>): void;

    /**
     * Starts SSE connection for a schema to receive real-time updates
     * Uses EventSource API when available (browser environments) and serverBaseUrl is configured
     * For Node.js or other environments, concrete implementations should override this method
     * @param schema The schema to stream changes for
     * @param sinceTimestamp Last known server timestamp (null for initial sync)
     * @param onData Callback when data is received
     * @param onError Callback when connection error occurs
     * @returns Function to close the connection
     */
    protected startSSEConnection(
        schema: CompiledSchema<UnknownRecord>,
        sinceTimestamp: number | null,
        onData: (data: UnknownRecord[], serverTimestamp: number) => void,
        onError: (error: Error) => void
    ): () => void {
        // Server base URL is required, so we can proceed directly

        // Check if EventSource is available (browser environments)
        if (typeof EventSource === 'undefined') {
            logger.log(`[SYNC] EventSource not available, SSE connection not supported. Override startSSEConnection for custom implementation.`);
            return () => { };
        }

        try {
            const baseUrl = this.syncOptions.serverBaseUrl;
            const since = sinceTimestamp ?? 0;
            const clientId = this.syncOptions.clientId;
            
            // Build SSE URL with query parameters
            const url = new URL(`${baseUrl}${SYNC_CONSTANTS.ENDPOINTS.CHANGES_STREAM}`);
            url.searchParams.set(SYNC_CONSTANTS.QUERY_PARAMS.TABLE, schema.collectionName);
            url.searchParams.set(SYNC_CONSTANTS.QUERY_PARAMS.SINCE, String(since));
            url.searchParams.set(SYNC_CONSTANTS.QUERY_PARAMS.CLIENT_ID, clientId);

            // Create EventSource connection
            const eventSource = new EventSource(url.toString());

            let isConnected = false;

            // Handle connection event
            eventSource.addEventListener('connected', () => {
                isConnected = true;
                logger.log(`[SYNC] SSE connected for ${schema.collectionName} (since: ${since})`);
            });

            // Handle change events
            eventSource.addEventListener('change', async (event: MessageEvent) => {
                try {
                    const eventData = JSON.parse(event.data);
                    const { type, entity, serverTimestamp } = eventData;

                    if (type && entity && serverTimestamp !== undefined) {
                        // Process the incoming entity using the helper method
                        // This ensures proper integration with the sync system
                        await this.processIncomingSSEData(schema, [entity as UnknownRecord], serverTimestamp);
                        
                        // Also call the onData callback for any additional handling
                        onData([entity as UnknownRecord], serverTimestamp);
                    } else {
                        logger.warn(`[SYNC] Invalid SSE change event format for ${schema.collectionName}`, eventData);
                    }
                } catch (error) {
                    logger.error(`[SYNC] Error parsing SSE change event for ${schema.collectionName}`, error);
                    onError(error instanceof Error ? error : new Error(String(error)));
                }
            });

            // Handle errors
            eventSource.onerror = (error) => {
                if (!isConnected && eventSource.readyState === EventSource.CONNECTING) {
                    // Connection failed to establish
                    logger.error(`[SYNC] Failed to establish SSE connection for ${schema.collectionName}`);
                    onError(new Error('Failed to establish SSE connection'));
                } else if (eventSource.readyState === EventSource.CLOSED) {
                    // Connection was closed
                    logger.log(`[SYNC] SSE connection closed for ${schema.collectionName}`);
                } else {
                    // Other error
                    logger.error(`[SYNC] SSE connection error for ${schema.collectionName}`, error);
                    onError(new Error('SSE connection error'));
                }
            };

            // Return cleanup function
            return () => {
                logger.log(`[SYNC] Closing SSE connection for ${schema.collectionName}`);
                eventSource.close();
            };
        } catch (error) {
            logger.error(`[SYNC] Error starting SSE connection for ${schema.collectionName}`, error);
            onError(error instanceof Error ? error : new Error(String(error)));
            return () => { };
        }
    }

    /**
     * Process incoming SSE data and apply it to the local store
     * This should be called by concrete implementations when SSE data arrives
     */
    protected async processIncomingSSEData<T>(
        schema: CompiledSchema<T>,
        data: T[],
        serverTimestamp: number
    ): Promise<void> {
        logger.log(`[SYNC] Processing ${data.length} incoming SSE record(s) for ${schema.collectionName}, serverTimestamp: ${serverTimestamp}`);
        await this.atomicSyncRemoteDataAsync(schema, data, serverTimestamp);
        logger.log(`[SYNC] Successfully processed incoming SSE data for ${schema.collectionName}`);
    }

    // Cleans up remote resources when the datastore is destroyed
    abstract destroyRemoteResources(done: CallbackResult<never>): void;

    /**
     * Builds pending change entries from schema changes
     */
    private buildQueueEntriesFromChanges(changes: BulkPersistChanges): Array<InferCreateType<typeof queueSchema>> {
        const queueAdds: Array<InferCreateType<typeof queueSchema>> = [];

        // Process all changes in a single pass
        // Use 'changes' (BulkPersistChanges) to access delta information, not 'result.data' (BulkPersistResult)
        for (const [schemaId, schemaChanges] of changes) {
            // Skip if no changes for this schema
            if (schemaChanges.hasItems === false) {
                continue;
            }

            const schema = this.schemas.get<UnknownRecord>(schemaId);
            assertIsNotNull(schema);

            const addsCount = schemaChanges.adds.length;
            const updatesCount = schemaChanges.updates.length;
            const removesCount = schemaChanges.removes.length;

            logger.log(`[SYNC] Queuing pending changes for ${schema.collectionName}: ${addsCount} add(s), ${updatesCount} update(s), ${removesCount} remove(s)`);

            // Queue all changes atomically with data changes
            // For adds: send full entity
            for (const add of schemaChanges.adds) {
                queueAdds.push(createQueueEntry(schemaId, schema, add, 'add', add));
            }

            // For updates: send only delta (changed properties) + record ID
            for (const update of schemaChanges.updates) {
                const deltaKeys = Object.keys(update.delta);
                // Store delta (changed properties only) along with record ID
                // The recordIds will be extracted from update.entity
                queueAdds.push(createQueueEntry(schemaId, schema, update.entity, 'update', { ...update.delta } as UnknownRecord));
                logger.log(`[SYNC] Queued update for ${schema.collectionName} with delta: ${deltaKeys.join(', ')}`);
            }

            // For removes: send only record ID
            for (const remove of schemaChanges.removes) {
                // Store minimal data (just ID) for removes
                // The recordIds will be extracted from remove entity
                queueAdds.push(createQueueEntry(schemaId, schema, remove, 'remove', {} as UnknownRecord));
            }
        }

        return queueAdds;
    }

    override onSavePreparedChanges(changes: BulkPersistChanges, done: CallbackPartialResult<BulkPersistResult>): void {
        try {
            const queueChanges = changes.resolve<UnknownRecord>(queueSchema.id);
            const queueAdds = this.buildQueueEntriesFromChanges(changes);

            // If we have pending changes, add them to changes BEFORE calling super
            // This ensures everything is persisted atomically in a single operation
            if (queueAdds.length > 0) {
                queueChanges.adds = queueAdds as any[];
                logger.log(`[SYNC] Added ${queueAdds.length} pending change(s) to persist atomically with data changes`);
            } else {
                logger.log(`[SYNC] No pending changes to add`);
            }

            // Now call super - it will persist changes (including pending changes) atomically
            super.onSavePreparedChanges(changes, done);
        } catch (e) {
            logger.error(`[SYNC] Error in onSavePreparedChanges`, e);
            done(Result.error(e));
        }
    }

    override destroy(done: CallbackResult<never>): void {
        super.destroy(result => {
            if (result.ok === Result.ERROR) {
                return done(result);
            }

            this.destroyRemoteResources(remoteResult => {
                done(remoteResult);
            });
        });
    }
}