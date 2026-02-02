/**
 * HTTP plugin with Stale-While-Revalidate (SWR).
 *
 * - Queries the store (e.g. IndexedDB) first; returns cached data immediately if present.
 * - If cache is empty: fetches from source (HTTP), persists to store, then returns (blocking).
 * - If cache has data: returns it, then revalidates in background when cache is stale (maxAgeMs).
 * - When revalidate completes: compares with schema.compare; if different, persists to store and
 *   calls done() again so the UI updates.
 */

import {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    ITranslatedValue,
} from '@routier/core/plugins';
import type { CompiledSchema, SchemaId, SubscriptionChanges } from '@routier/core/schema';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
    Result,
} from '@routier/core/results';
import { BulkPersistResult, BulkPersistChanges, SchemaPersistChanges } from '@routier/core/collections';
import { logger, UnknownRecord, uuid } from '@routier/core/utilities';
import { HttpDbPlugin, HttpPluginOptions } from './HttpDbPlugin';
import { assertIsNotNull } from '@routier/core';

import type { AuthErrorEvent } from './auth';
import { isAuthError, buildAuthErrorEvent } from './auth';
import { UnsyncedQueue } from './UnsyncedQueue';
import { entityIdKey, resultSetsEqual } from './swrUtils';
import { SWR_DEFAULTS } from './constants';

// Re-export for consumers
export type { AuthErrorEvent } from './auth';

/** SWR-specific options for HttpSwrDbPlugin. */
export interface HttpSwrDbPluginOptions extends HttpPluginOptions {
    /** Max time (ms) to consider cache fresh; after this, the next read triggers a background revalidate. Default 60_000. */
    maxAgeMs?: number;
    /** Base delay (ms) for exponential backoff on bulkPersist retry. Default 1000. */
    bulkPersistRetryBaseDelayMs?: number;
    /** Max delay (ms) between bulkPersist retries when offline. Default 60_000. No max attempt count for non-auth errors. */
    bulkPersistRetryMaxDelayMs?: number;
    /** Base delay (ms) for exponential backoff on query retry. Default 1000. */
    queryRetryBaseDelayMs?: number;
    /** Max delay (ms) between query retries when offline. Default 60_000. No max attempt count for non-auth errors. */
    queryRetryMaxDelayMs?: number;
    /**
     * Called when the remote returns 401 or 403 so higher-level code can trigger re-authentication.
     * Invoked for both query and bulkPersist; use event.context to distinguish.
     */
    onAuthError?: (event: AuthErrorEvent) => void;
    /**
     * IDbPlugin to use for persisting the unsynced queue (e.g. same as swrStore). No datastore required.
     * When set, the queue is stored via query/bulkPersist in a reserved collection (_routier_unsynced).
     * If not set, UnsyncedQueue uses the memory plugin (in-memory only; unsynced items cleared on refresh).
     */
    unsyncedQueueStore?: IDbPlugin;
}

interface CacheMetadata {
    lastRevalidatedAt: number;
}

/** Result of comparing incoming rows with store + unsynced set during revalidate. */
interface RevalidateClassification {
    adds: unknown[];
    updates: { entity: unknown; changeType: 'propertiesChanged'; delta: Record<string, unknown> }[];
    removes: unknown[];
}

export class HttpSwrDbPlugin extends HttpDbPlugin {
    private readonly swrStore: IDbPlugin;
    private readonly maxAgeMs: number;
    private readonly bulkPersistRetryBaseDelayMs: number;
    private readonly bulkPersistRetryMaxDelayMs: number;
    private readonly queryRetryBaseDelayMs: number;
    private readonly queryRetryMaxDelayMs: number;
    private readonly onAuthError?: (event: AuthErrorEvent) => void;
    private readonly unsyncedQueue: UnsyncedQueue;
    private readonly cacheMetadata = new Map<number, CacheMetadata>();
    private readonly revalidateInFlight = new Map<number, Promise<void>>();

    constructor(
        swrStore: IDbPlugin,
        options: HttpSwrDbPluginOptions,
    ) {
        super(options);
        this.swrStore = swrStore;
        this.maxAgeMs = options?.maxAgeMs ?? SWR_DEFAULTS.maxAgeMs;
        this.bulkPersistRetryBaseDelayMs = options?.bulkPersistRetryBaseDelayMs ?? SWR_DEFAULTS.bulkPersistRetryBaseDelayMs;
        this.bulkPersistRetryMaxDelayMs = options?.bulkPersistRetryMaxDelayMs ?? SWR_DEFAULTS.bulkPersistRetryMaxDelayMs;
        this.queryRetryBaseDelayMs = options?.queryRetryBaseDelayMs ?? SWR_DEFAULTS.queryRetryBaseDelayMs;
        this.queryRetryMaxDelayMs = options?.queryRetryMaxDelayMs ?? SWR_DEFAULTS.queryRetryMaxDelayMs;
        this.onAuthError = options?.onAuthError;
        this.unsyncedQueue = new UnsyncedQueue(options?.unsyncedQueueStore);
        this.startBackgroundSync();
    }

    /** Started automatically in constructor. Retries flushing unsynced items using bulkPersist retry delays. */
    private startBackgroundSync(): void {
        const run = (attempt: number) => {
            const delayMs = Math.min(
                this.bulkPersistRetryBaseDelayMs * Math.pow(2, attempt),
                this.bulkPersistRetryMaxDelayMs
            );
            setTimeout(() => {
                void this.flushUnsynced()
                    .catch((err) => {
                        logger.warn('[HttpSwrDbPlugin] background flushUnsynced failed', { error: err });
                    })
                    .finally(() => run(attempt + 1));
            }, delayMs);
        };
        run(0);
    }

    /**
     * Reissue POST for unsynced items using data stored in the queue (no schema cache, no SWR query).
     */
    private async flushUnsynced(): Promise<void> {
        const collections = await this.unsyncedQueue.getUnsyncedCollections();
        if (collections.length === 0) return;

        const headers = await this.requestHeaders();

        for (const collectionName of collections) {
            const { keys, entities } = await this.unsyncedQueue.getUnsyncedEntitiesForFlush(collectionName);
            if (entities.length === 0) continue;

            const body = JSON.stringify({ adds: entities, updates: [], removes: [] });
            const url = this.collectionUrl(collectionName);
            try {
                await this.postWithRetry(url, headers, body, collectionName);
                this.unsyncedQueue.removeByKeys(collectionName, keys);
            } catch {
                // Already logged in postWithRetry; next tick will retry
            }
        }
    }

    private notifyAuthError(event: AuthErrorEvent): void {
        try {
            this.onAuthError?.(event);
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] onAuthError threw', { error: err });
        }
    }

    private getCacheKey<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): number {
        return event.operation.schema.id;
    }

    private queryRemoteWithRetry<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        onSuccess: (result: { ok: typeof Result.SUCCESS; data: ITranslatedValue<TShape> }) => void,
        onFinalFailure: () => void
    ): void {
        const collectionName = event.operation.schema.collectionName;
        const tryRemote = (attempt: number) => {
            super.handleQuery(event, (sourceResult) => {
                if (sourceResult.ok === Result.SUCCESS) {
                    onSuccess(sourceResult);
                    return;
                }
                const err = sourceResult.error;
                if (isAuthError(err)) {
                    const authEvent = buildAuthErrorEvent(err, 'query');
                    if (authEvent) this.notifyAuthError(authEvent);
                    logger.warn('[HttpSwrDbPlugin] query remote failed (auth), not retrying', {
                        collectionName,
                        attempt: attempt + 1,
                    });
                    onFinalFailure();
                    return;
                }
                const delayMs = Math.min(
                    this.queryRetryBaseDelayMs * Math.pow(2, attempt),
                    this.queryRetryMaxDelayMs
                );
                logger.warn('[HttpSwrDbPlugin] query remote failed, retrying', {
                    collectionName,
                    attempt: attempt + 1,
                    delayMs,
                    error: err,
                });
                setTimeout(() => tryRemote(attempt + 1), delayMs);
            });
        };
        tryRemote(0);
    }

    private isStale(cacheKey: number): boolean {
        const meta = this.cacheMetadata.get(cacheKey);
        if (!meta) {
            return true;
        }
        return Date.now() - meta.lastRevalidatedAt > this.maxAgeMs;
    }

    private setRevalidated(cacheKey: number): void {
        this.cacheMetadata.set(cacheKey, { lastRevalidatedAt: Date.now() });
    }

    /**
     * Compare incoming rows with store state + unsynced set: classify into adds, updates, removes.
     */
    private classifyRevalidateChanges(
        schema: CompiledSchema<Record<string, unknown>>,
        incomingRows: unknown[],
        existingArr: unknown[],
        unsyncedKeys: Set<string>
    ): RevalidateClassification {
        const existingById = new Map<ReturnType<CompiledSchema<Record<string, unknown>>['getIds']>[0], unknown>();
        for (const e of existingArr) {
            existingById.set(schema.getIds(e as never)[0], e);
        }
        const incomingIdSet = new Set(incomingRows.map((r) => schema.getIds(r as never)[0]));

        const adds = incomingRows.filter((r) => !existingById.has(schema.getIds(r as never)[0]));
        const updates = incomingRows
            .filter((r) => {
                const id = schema.getIds(r as never)[0];
                const existing = existingById.get(id);
                return existing != null && !schema.compare(r as never, existing as never);
            })
            .map((entity) => ({ entity, changeType: 'propertiesChanged' as const, delta: {} as Record<string, unknown> }));
        // Only remove from store if not in server response AND not in unsynced queue
        // (unsynced = written locally but not yet confirmed; keep in store until synced)
        const removes = existingArr.filter((e) => {
            if (incomingIdSet.has(schema.getIds(e as never)[0])) return false;
            return !unsyncedKeys.has(entityIdKey(schema, e));
        });

        return { adds, updates, removes };
    }

    /**
     * Persist a revalidate classification to the SWR store and call done.
     */
    private applyRevalidatePersist<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        schema: CompiledSchema<Record<string, unknown>>,
        classification: RevalidateClassification,
        translated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const { adds, updates, removes } = classification;
        const bulkChanges = new BulkPersistChanges();
        const schemaChanges = bulkChanges.resolve(schema.id);
        schemaChanges.adds = adds as never[];
        schemaChanges.updates = updates as never[];
        schemaChanges.removes = removes as never[];

        const swrEvent: DbPluginBulkPersistEvent = {
            id: uuid(8),
            schemas: event.schemas,
            operation: bulkChanges,
            source: HttpSwrDbPlugin.name,
            action: 'persist' as const,
            reason: 'revalidate',
        };
        this.swrStore.bulkPersist(swrEvent, (persistResult) => {
            if (persistResult.ok === Result.ERROR) {
                logger.error('[HttpSwrDbPlugin] persistToStore failed', {
                    collectionName: schema.collectionName,
                    error: persistResult.error,
                });
                done(PluginEventResult.error(event.id, persistResult.error));
                return;
            }
            this.notifySchemaSubscription(schema, classification);
            done(PluginEventResult.success(event.id, translated));
        });
    }

    /**
     * Notify the schema subscription so subscribed queries re-run and the UI updates.
     * Without this, calling done() again does not reliably update subscribed UIs (e.g. after a delete + refresh).
     */
    private notifySchemaSubscription(
        schema: CompiledSchema<Record<string, unknown>>,
        classification: RevalidateClassification
    ): void {
        const subscription = schema.createSubscription();
        subscription.send({
            adds: classification.adds,
            updates: classification.updates.map((u) => u.entity),
            removals: classification.removes,
            unknown: [],
        } as SubscriptionChanges<Record<string, unknown>>);
    }

    /**
     * Revalidate: fetch current from store, classify vs incoming rows (using unsynced set), persist diff to store.
     */
    private async persistToStore<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        translated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
        const value = translated.value;
        const incomingRows: unknown[] = Array.isArray(value) ? [...value] : typeof value === 'object' && value != null ? [value] : [];

        const storeQueryEvent: DbPluginQueryEvent<TRoot, TShape> = {
            ...event,
            id: uuid(8),
            source: HttpSwrDbPlugin.name,
            action: 'query' as const,
            reason: 'revalidate-sync',
            operation: event.operation,
        };

        this.swrStore.query(storeQueryEvent, async (queryResult) => {
            if (queryResult.ok === Result.ERROR) {
                logger.error('[HttpSwrDbPlugin] persistToStore store query failed', {
                    collectionName: schema.collectionName,
                    error: queryResult.error,
                });
                done(PluginEventResult.error(event.id, queryResult.error));
                return;
            }

            const existingArr =
                queryResult.data?.value != null && Array.isArray(queryResult.data.value)
                    ? (queryResult.data.value as unknown[])
                    : [];
            const unsyncedKeys = await this.unsyncedQueue.getUnsyncedIdKeys(schema.collectionName);
            const classification = this.classifyRevalidateChanges(schema, incomingRows, existingArr, unsyncedKeys);

            this.applyRevalidatePersist(event, schema, classification, translated, done);
        });
    }

    private startRevalidate<TRoot extends {}, TShape>(
        cacheKey: number,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        const existing = this.revalidateInFlight.get(cacheKey);
        if (existing) {
            logger.debug('[HttpSwrDbPlugin] revalidate deduplicated', { collectionName, cacheKey });
            void existing;
            return;
        }

        logger.debug('[HttpSwrDbPlugin] revalidate started', { collectionName, cacheKey });
        const promise = this.runRevalidate(cacheKey, event, cachedTranslated, done);
        this.revalidateInFlight.set(cacheKey, promise);
        void promise.finally(() => {
            this.revalidateInFlight.delete(cacheKey);
        });
    }

    private runRevalidate<TRoot extends {}, TShape>(
        cacheKey: number,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const collectionName = event.operation.schema.collectionName;
        return new Promise((resolve) => {
            this.queryRemoteWithRetry(
                event,
                (sourceResult) => {
                    const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
                    const cachedArr = (cachedTranslated.value as unknown) as unknown[];
                    const sourceArr = (sourceResult.data.value as unknown) as unknown[];
                    const same = resultSetsEqual(schema, cachedArr, sourceArr);
                    this.setRevalidated(cacheKey);
                    if (!same) {
                        this.persistToStore(event, sourceResult.data, done);
                    }
                    resolve();
                },
                () => {
                    logger.warn('[HttpSwrDbPlugin] revalidate source query failed, keeping cache', {
                        collectionName,
                        cacheKey,
                    });
                    resolve();
                }
            );
        });
    }

    /**
     * handleQuery flow: 1) Query swrStore. 2) If empty → fetch from remote, persist, return.
     * 3) If has data → return it; if stale → revalidate in background.
     */
    protected override async handleQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const cacheKey = this.getCacheKey(event);
        const collectionName = event.operation.schema.collectionName;

        this.swrStore.query(event, (swrResponse) => {
            if (swrResponse.ok === Result.ERROR) {
                logger.warn('[HttpSwrDbPlugin] swrStore query failed', { collectionName, error: swrResponse.error });
                done(swrResponse);
                return;
            }

            const hasData =
                swrResponse.data?.value != null &&
                Array.isArray(swrResponse.data.value) &&
                swrResponse.data.value.length > 0;

            if (!hasData) {
                logger.debug('[HttpSwrDbPlugin] cache miss, fetching from source', { collectionName });
                this.queryRemoteWithRetry(
                    event,
                    (sourceResult) => {
                        this.setRevalidated(cacheKey);
                        this.persistToStore(event, sourceResult.data, done);
                    },
                    () => {
                        logger.warn('[HttpSwrDbPlugin] query remote failed, falling back to SWR store', {
                            collectionName,
                        });
                        this.swrStore.query(event, (swrResult) => {
                            done(swrResult);
                        });
                    }
                );
                return;
            }

            const count = (swrResponse.data.value as unknown[]).length;
            logger.debug('[HttpSwrDbPlugin] cache hit', { collectionName, count, stale: this.isStale(cacheKey) });
            done(PluginEventResult.success(event.id, swrResponse.data));

            if (this.isStale(cacheKey)) {
                setTimeout(() => {
                    this.startRevalidate(cacheKey, event, swrResponse.data, done);
                }, 0);
            }
        });
    }

    private persistToSwrStore(event: DbPluginBulkPersistEvent): Promise<void> {
        return new Promise((resolve, reject) => {
            const swrEvent: DbPluginBulkPersistEvent = {
                ...event,
                id: uuid(8),
                source: HttpSwrDbPlugin.name,
                action: 'persist' as const,
                reason: 'optimistic',
            };
            this.swrStore.bulkPersist(swrEvent, (persistResult) => {
                if (persistResult.ok === Result.ERROR) {
                    reject(persistResult.error);
                    return;
                }
                resolve();
            });
        });
    }

    private async postWithRetry(
        url: string,
        headers: Record<string, string>,
        body: string,
        collectionName: string,
    ): Promise<void> {
        let lastError: Error | null = null;
        let attempt = 0;

        for (; ;) {
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body,
                });

                if (res.ok) {
                    if (attempt > 0) {
                        logger.info('[HttpSwrDbPlugin] bulkPersist succeeded on retry', {
                            collectionName,
                            attempt,
                        });
                    }
                    return;
                }

                lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
                if (res.status === 401 || res.status === 403) break;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
            }

            if (lastError != null && isAuthError(lastError)) break;

            const delayMs = Math.min(
                this.bulkPersistRetryBaseDelayMs * Math.pow(2, attempt),
                this.bulkPersistRetryMaxDelayMs
            );
            logger.warn('[HttpSwrDbPlugin] bulkPersist failed, retrying', {
                collectionName,
                attempt: attempt + 1,
                delayMs,
                error: lastError,
            });
            await new Promise((r) => setTimeout(r, delayMs));
            attempt++;
        }

        if (lastError != null && isAuthError(lastError)) {
            const authEvent = buildAuthErrorEvent(lastError, 'bulkPersist');
            if (authEvent) this.notifyAuthError(authEvent);
        }
        throw lastError ?? new Error('bulkPersist failed');
    }

    protected formatRequestBody(changes: SchemaPersistChanges<Record<string, unknown>>, schema: CompiledSchema<UnknownRecord>) {
        const { adds, updates, removes } = changes;
        return JSON.stringify({ adds, updates, removes });
    }

    /**
     * One schema's HTTP POST + finalize (remove from unsynced queue, mutate result).
     * Used after all POSTs succeed to avoid mutating result on partial failure.
     */
    private finalizeBulkPersistSchema(
        schemaId: SchemaId,
        schema: CompiledSchema<UnknownRecord>,
        changes: SchemaPersistChanges<UnknownRecord>,
        entitiesToRemoveFromQueue: unknown[],
        result: BulkPersistResult
    ): void {
        const { adds, updates, removes } = changes;
        if (entitiesToRemoveFromQueue.length > 0) {
            this.unsyncedQueue.removeMany(schema, entitiesToRemoveFromQueue);
        }
        const persistResult = result.get<UnknownRecord>(schemaId);
        persistResult.adds.push(...adds);
        persistResult.updates.push(...updates.map((x) => x.entity));
        persistResult.removes.push(...removes);
    }

    protected override async handleBulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        const result = event.operation.toResult();

        try {
            await this.persistToSwrStore(event);

            const headers = await this.requestHeaders();
            const postTasks: Array<{
                url: string;
                headers: Record<string, string>;
                body: string;
                collectionName: string;
                schemaId: SchemaId;
                schema: CompiledSchema<UnknownRecord>;
                changes: SchemaPersistChanges<UnknownRecord>;
                entitiesToRemoveFromQueue: unknown[];
            }> = [];

            for (const [schemaId, changes] of event.operation) {
                if (!changes.hasItems) continue;

                const schema = event.schemas.get<UnknownRecord>(schemaId);
                assertIsNotNull(schema);

                const { adds, updates, removes } = changes;
                const collectionName = schema.collectionName;
                const entitiesToTrack = [...adds, ...updates.map((u) => u.entity)];
                if (entitiesToTrack.length > 0) {
                    this.unsyncedQueue.addMany(schema, entitiesToTrack);
                }

                logger.debug('[HttpSwrDbPlugin] bulkPersist', {
                    eventId: event.id,
                    schemaId,
                    collectionName,
                    adds: adds.length,
                    updates: updates.length,
                    removes: removes.length,
                });

                postTasks.push({
                    url: this.collectionUrl(collectionName),
                    headers,
                    body: this.formatRequestBody(changes, schema),
                    collectionName,
                    schemaId,
                    schema,
                    changes,
                    entitiesToRemoveFromQueue: [...entitiesToTrack, ...(removes as unknown[])],
                });
            }

            const postResults = await Promise.allSettled(
                postTasks.map((t) =>
                    this.postWithRetry(t.url, t.headers, t.body, t.collectionName)
                )
            );

            for (let i = 0; i < postResults.length; i++) {
                if (postResults[i].status === 'fulfilled') {
                    const t = postTasks[i];
                    this.finalizeBulkPersistSchema(
                        t.schemaId,
                        t.schema,
                        t.changes,
                        t.entitiesToRemoveFromQueue,
                        result
                    );
                }
            }

            const rejected = postResults
                .map((outcome, i) => (outcome.status === 'rejected' ? { index: i, reason: outcome.reason } : null))
                .filter((r): r is { index: number; reason: unknown } => r != null);
            if (rejected.length > 0) {
                if (rejected.length > 1) {
                    logger.warn('[HttpSwrDbPlugin] bulkPersist multiple POSTs failed', {
                        eventId: event.id,
                        failedCount: rejected.length,
                        reasons: rejected.map((r) => String(r.reason)),
                    });
                }
                const err = rejected[0].reason;
                throw err instanceof Error ? err : new Error(String(err));
            }

            done(PluginEventResult.success(event.id, result));
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] bulkPersist failed', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }
}
