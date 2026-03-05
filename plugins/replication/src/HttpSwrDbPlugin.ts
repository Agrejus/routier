/**
 * HTTP plugin with Stale-While-Revalidate (SWR).
 *
 * - Queries the store (e.g. IndexedDB) first; returns cached data immediately if present.
 * - If cache is empty: fetches from source (HTTP), persists to store, then returns (blocking).
 * - If cache has data: returns it, then revalidates in background when cache is stale (maxAgeMs).
 * - When revalidate completes: compares with schema.compare; if different, persists to store and
 *   On revalidate success, persists to store and notifies subscription handlers so the UI updates;
 *   revalidate failures are not reported via done() (optional onRevalidateError callback for devs).
 */

import {
    IDbPlugin,
    DbPluginEvent,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    ITranslatedValue,
} from '@routier/core/plugins';
import type { CompiledSchema, SchemaId, SubscriptionChanges } from '@routier/core/schema';
import { HashType } from '@routier/core/schema';
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
    /** Max delay (ms) between bulkPersist retries. Default 60_000. */
    bulkPersistRetryMaxDelayMs?: number;
    /** Max number of bulkPersist attempts (including initial). Default 10. Auth errors (401/403) stop immediately. */
    bulkPersistRetryMaxAttempts?: number;
    /** Passed to HttpDbPlugin (query retry is handled there). Base delay (ms) for backoff. Default 1000. */
    queryRetryBaseDelayMs?: number;
    /** Passed to HttpDbPlugin (query retry is handled there). Max delay (ms) between retries. Default 60_000. */
    queryRetryMaxDelayMs?: number;
    /**
     * Called when the remote returns 401 or 403 so higher-level code can trigger re-authentication.
     * Invoked for both query and bulkPersist; use event.context to distinguish.
     */
    onAuthError?: (event: AuthErrorEvent) => void;
    /**
     * Called when background revalidate fails (e.g. offline, network error). Use for logging or toasts.
     * Revalidate failures are not reported back via done(); the UI keeps showing cached data.
     */
    onRevalidateError?: (error: Error, context: { collectionName: string; cacheKey?: number }) => void;
    /**
     * IDbPlugin to use for persisting the unsynced queue (e.g. same as swrStore). No datastore required.
     * When set, the queue is stored via query/bulkPersist in a reserved collection (_routier_unsynced).
     * If not set, UnsyncedQueue uses the memory plugin (in-memory only; unsynced items cleared on refresh).
     */
    unsyncedQueueStore: IDbPlugin;
}

interface CacheMetadata {
    lastRevalidatedAt: number;
}

/** Result of comparing incoming rows with store + unsynced set during revalidate. */
interface RevalidateClassification {
    adds: unknown[];
    updates: { entity: unknown; changeType: 'markedDirty'; delta: Record<string, unknown> }[];
    removes: unknown[];
}

/** Single-schema task for bulk persist: POST payload + data needed to finalize on success. */
interface BulkPersistTask {
    url: string;
    headers: Record<string, string>;
    body: string;
    collectionName: string;
    schemaId: SchemaId;
    schema: CompiledSchema<UnknownRecord>;
    changes: SchemaPersistChanges<UnknownRecord>;
    entitiesToRemoveFromQueue: unknown[];
}

const cacheMetadata = new Map<number, CacheMetadata>();

export class HttpSwrDbPlugin implements IDbPlugin {
    private readonly httpPlugin: HttpDbPlugin;
    private readonly swrStore: IDbPlugin;
    private readonly maxAgeMs: number;
    private readonly bulkPersistRetryBaseDelayMs: number;
    private readonly bulkPersistRetryMaxDelayMs: number;
    private readonly bulkPersistRetryMaxAttempts: number;
    private readonly onAuthError?: (event: AuthErrorEvent) => void;
    private readonly onRevalidateError?: (error: Error, context: { collectionName: string; cacheKey?: number }) => void;
    private readonly unsyncedQueue: UnsyncedQueue;
    private readonly revalidateInFlight = new Map<number, Promise<void>>();

    constructor(
        swrStore: IDbPlugin,
        options: HttpSwrDbPluginOptions,
    ) {
        this.httpPlugin = new HttpDbPlugin(options);
        this.swrStore = swrStore;
        this.maxAgeMs = options?.maxAgeMs ?? SWR_DEFAULTS.maxAgeMs;
        this.bulkPersistRetryBaseDelayMs = options?.bulkPersistRetryBaseDelayMs ?? SWR_DEFAULTS.bulkPersistRetryBaseDelayMs;
        this.bulkPersistRetryMaxDelayMs = options?.bulkPersistRetryMaxDelayMs ?? SWR_DEFAULTS.bulkPersistRetryMaxDelayMs;
        this.bulkPersistRetryMaxAttempts = options?.bulkPersistRetryMaxAttempts ?? SWR_DEFAULTS.bulkPersistRetryMaxAttempts;
        this.onAuthError = options?.onAuthError;
        this.onRevalidateError = options?.onRevalidateError;
        this.unsyncedQueue = new UnsyncedQueue(options.unsyncedQueueStore);
        this.startBackgroundSync();
    }

    query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.queryAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {

        logger.info("[HttpSwrDbPlugin] bulkPersist MAIN", { event });

        this.bulkPersistAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.httpPlugin.destroy(event, done);
    }

    /** Retries flushing unsynced items on a timer using bulkPersist retry delays. */
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

        const headers = await this.httpPlugin.requestHeaders();

        for (const collectionName of collections) {
            const { keys, entities } = await this.unsyncedQueue.getUnsyncedEntitiesForFlush(collectionName);
            if (entities.length === 0) continue;

            const body = JSON.stringify({ adds: entities, updates: [], removes: [] });
            const url = this.httpPlugin.collectionUrl(collectionName);
            try {
                await this.postWithRetry(url, headers, body, collectionName);
                this.unsyncedQueue.removeByKeys(collectionName, keys);
            } catch {
                // Already logged in postWithRetry; next tick will retry
            }
        }
    }

    // ─── Auth ─────────────────────────────────────────────────────────────────

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

    private isStale(cacheKey: number): boolean {
        const meta = cacheMetadata.get(cacheKey);
        if (!meta) {
            return true;
        }
        return Date.now() - meta.lastRevalidatedAt > this.maxAgeMs;
    }

    private setRevalidated(cacheKey: number): void {
        cacheMetadata.set(cacheKey, { lastRevalidatedAt: Date.now() });
    }

    /** Classify incoming server rows vs store + unsynced set into adds, updates, removes. */
    private classifyRevalidateChanges(
        schema: CompiledSchema<Record<string, unknown>>,
        incomingRows: unknown[],
        existingArr: unknown[],
        unsyncedKeys: Set<string>
    ): RevalidateClassification {
        const existingById = new Map<string, unknown>();
        for (const e of existingArr) {
            existingById.set(schema.hash(e as never, HashType.Ids), e);
        }
        const incomingIdSet = new Set(incomingRows.map((r) => schema.hash(r as never, HashType.Ids)));

        const adds = incomingRows.filter((r) => !existingById.has(schema.hash(r as never, HashType.Ids)));
        const updates = incomingRows
            .filter((r) => {
                const id = schema.hash(r as never, HashType.Ids);
                const existing = existingById.get(id);
                return existing != null && !schema.compare(r as never, existing as never);
            })
            .map((entity) => ({ entity, changeType: 'markedDirty' as const, delta: {} as Record<string, unknown> }));

        // Only remove from store if not in server response AND not in unsynced queue
        // (unsynced = written locally but not yet confirmed; keep in store until synced)
        const removes = existingArr.filter((e) => {
            if (incomingIdSet.has(schema.hash(e as never, HashType.Ids))) {
                return false;
            }

            return !unsyncedKeys.has(entityIdKey(schema, e));
        });

        return { adds, updates, removes };
    }

    /**
     * Persist a revalidate classification to the SWR store. Resolves when the store has been updated.
     */
    private applyRevalidatePersist<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        schema: CompiledSchema<Record<string, unknown>>,
        classification: RevalidateClassification
    ): Promise<void> {
        const collectionName = schema.collectionName;
        const { adds, updates, removes } = classification;
        const bulkChanges = new BulkPersistChanges();
        const schemaChanges = bulkChanges.resolve(schema.id);
        schemaChanges.adds = adds as never[];
        schemaChanges.updates = updates as never[];
        schemaChanges.removes = removes as never[];

        if (adds.length === 0 && updates.length === 0 && removes.length === 0) {
            logger.debug('[HttpSwrDbPlugin] applyRevalidatePersist() -> no changes', {
                classification,
                bulkChanges
            });
            return Promise.resolve();
        }

        const swrEvent: DbPluginBulkPersistEvent = {
            id: uuid(8),
            schemas: event.schemas,
            operation: bulkChanges,
            source: HttpSwrDbPlugin.name,
            action: 'persist' as const,
            reason: 'revalidate',
        };

        logger.debug('[HttpSwrDbPlugin] applyRevalidatePersist() -> before persist', {
            classification,
            bulkChanges
        });

        return new Promise((resolve, reject) => {
            this.swrStore.bulkPersist(swrEvent, (persistResult) => {

                logger.debug('[HttpSwrDbPlugin] applyRevalidatePersist() -> after persist', {
                    classification,
                    bulkChanges,
                    persistResult
                });

                if (persistResult.ok === Result.ERROR) {
                    this.onRevalidateError?.(persistResult.error, { collectionName });
                    reject(persistResult.error);
                    return;
                }
                this.notifySchemaSubscription(schema, classification);
                resolve();
            });
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

        logger.debug('[HttpSwrDbPlugin] notifySchemaSubscription() -> send', {
            classification,
            schema,
            collectionName: schema.collectionName
        });

        const subscription = schema.createSubscription();
        subscription.send({
            adds: classification.adds,
            updates: classification.updates.map((u) => u.entity),
            removals: classification.removes,
            unknown: [],
        } as SubscriptionChanges<Record<string, unknown>>);
    }

    /** Builds a query event used to read current store state during revalidate (same operation, new id/source/reason). */
    private buildRevalidateStoreQueryEvent<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>
    ): DbPluginQueryEvent<TRoot, TShape> {
        return {
            ...event,
            id: uuid(8),
            source: HttpSwrDbPlugin.name,
            action: 'query' as const,
            reason: 'revalidate-sync',
            operation: event.operation,
        };
    }

    /**
     * Compares incoming server rows with current store + unsynced set, then persists the diff to the SWR store.
     * Resolves when the store has been updated.
     */
    private async mergeRevalidateAndPersist<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        schema: CompiledSchema<Record<string, unknown>>,
        incomingRows: unknown[],
        currentStoreTranslated: ITranslatedValue<TShape>
    ): Promise<void> {
        const currentRows = this.queryResultToArray(currentStoreTranslated);
        const unsyncedKeys = await this.unsyncedQueue.getUnsyncedIdKeys(schema.collectionName);
        const classification = this.classifyRevalidateChanges(schema, incomingRows, currentRows, unsyncedKeys);

        logger.debug('[HttpSwrDbPlugin] mergeRevalidateAndPersist() -> classification', {
            classification,
            unsyncedKeys,
            currentRows
        });

        await this.applyRevalidatePersist(event, schema, classification);
    }

    /**
     * Persist incoming server data when the cache was empty (cache miss). Does not query the store;
     * we already know current state is empty from the initial swrStore.query. Resolves when the store has been updated.
     */
    private async persistOnCacheMiss<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        translated: ITranslatedValue<TShape>
    ): Promise<void> {
        const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
        const collectionName = schema.collectionName;
        const incomingRows = this.queryResultToArray(translated);
        const unsyncedKeys = await this.unsyncedQueue.getUnsyncedIdKeys(collectionName);
        const classification = this.classifyRevalidateChanges(schema, incomingRows, [], unsyncedKeys);
        await this.applyRevalidatePersist(event, schema, classification);
    }

    /**
     * Revalidate: persist incoming server data into the SWR store when we already have cached data.
     * Queries the store once to get current state, then merges with incoming and persists the diff.
     * Resolves when the store has been updated.
     */
    private persistToStore<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        translated: ITranslatedValue<TShape>
    ): Promise<void> {
        const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
        const collectionName = schema.collectionName;
        const incomingRows = this.queryResultToArray(translated);
        const storeQueryEvent = this.buildRevalidateStoreQueryEvent(event);

        logger.debug('[HttpSwrDbPlugin] persistToStore() -> started', {
            collectionName,
            translated
        });

        return new Promise((resolve, reject) => {
            this.swrStore.query(storeQueryEvent, async (queryResult) => {

                logger.debug('[HttpSwrDbPlugin] persistToStore() -> query swrStore', {
                    collectionName,
                    storeQueryEvent,
                    queryResult
                });

                if (queryResult.ok === Result.ERROR) {
                    this.onRevalidateError?.(queryResult.error, { collectionName });
                    reject(queryResult.error);
                    return;
                }
                try {
                    await this.mergeRevalidateAndPersist(
                        event,
                        schema,
                        incomingRows,
                        queryResult.data
                    );
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    private queryResultToArray<T>(translatedValue: ITranslatedValue<T>) {
        const result: unknown[] = [];
        translatedValue.forEach(item => {
            result.push(item)
        });
        return result;
    }

    private startRevalidate<TRoot extends {}, TShape>(
        cacheKey: number,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        const existing = this.revalidateInFlight.get(cacheKey);
        if (existing) {
            logger.debug('[HttpSwrDbPlugin] revalidate deduplicated', { collectionName, cacheKey });
            void existing;
            return;
        }

        logger.debug('[HttpSwrDbPlugin] revalidate started', { collectionName, cacheKey });
        const promise = this.runRevalidate(cacheKey, event, cachedTranslated);
        this.revalidateInFlight.set(cacheKey, promise);
        void promise.finally(() => {
            this.revalidateInFlight.delete(cacheKey);
        });
    }

    private runRevalidate<TRoot extends {}, TShape>(
        cacheKey: number,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>
    ): Promise<void> {
        const collectionName = event.operation.schema.collectionName;
        return new Promise((resolve) => {
            this.httpPlugin.query(event, (result) => {
                logger.debug('[HttpSwrDbPlugin] runRevalidate() -> httpPlugin query result', { collectionName, result });
                if (result.ok === Result.SUCCESS) {
                    const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
                    const cachedArr = this.queryResultToArray(cachedTranslated);
                    const sourceArr = this.queryResultToArray(result.data);
                    const same = resultSetsEqual(schema, cachedArr, sourceArr);
                    logger.debug('[HttpSwrDbPlugin] runRevalidate() -> httpPlugin query success', {
                        collectionName,
                        result,
                        same
                    });
                    if (same) {
                        this.setRevalidated(cacheKey);
                        resolve();
                    } else {
                        this.persistToStore(event, result.data).then(
                            () => {
                                this.setRevalidated(cacheKey);
                                resolve();
                            },
                            () => resolve()
                        );
                    }
                } else {
                    this.onRevalidateError?.(result.error, { collectionName, cacheKey });
                    resolve();
                }
            });
        });
    }

    private async queryAsync<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const cacheKey = this.getCacheKey(event);
        this.swrStore.query(event, (swrResponse) => {
            const collectionName = event.operation.schema.collectionName;
            if (swrResponse.ok === Result.ERROR) {
                logger.warn('[HttpSwrDbPlugin] swrStore query failed', { collectionName, error: swrResponse.error });
                done(swrResponse);
                return;
            }

            const hasData = !swrResponse.data.isEmpty;

            if (!hasData) {
                this.onCacheMiss(event, cacheKey, done);
                return;
            }

            done(swrResponse);

            if (this.isStale(cacheKey)) {
                logger.info('[HttpSwrDbPlugin] Cache is stale, starting revalidation', { collectionName });
                setTimeout(() => this.startRevalidate(cacheKey, event, swrResponse.data), 0);
            } else {
                logger.info('[HttpSwrDbPlugin] cache not stale');
            }
        });
    }

    /**
     * Cache was empty: fetch from remote, persist to store (no second store query), then complete.
     */
    private onCacheMiss<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        cacheKey: number,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        logger.debug('[HttpSwrDbPlugin] cache miss, fetching from source', { collectionName });
        this.httpPlugin.query(event, (result) => {
            if (result.ok === Result.SUCCESS) {
                this.persistOnCacheMiss(event, result.data).then(
                    () => {
                        this.setRevalidated(cacheKey);
                        done(PluginEventResult.success(event.id, result.data));
                    },
                    (err) => {
                        this.onRevalidateError?.(err, { collectionName });
                        done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
                    }
                );
                return;
            }
            if (isAuthError(result.error)) {
                const authEvent = buildAuthErrorEvent(result.error, 'query');
                if (authEvent) {
                    this.notifyAuthError(authEvent);
                }
            }
            logger.warn('[HttpSwrDbPlugin] query remote failed, falling back to SWR store', { collectionName });
            this.swrStore.query(event, done);
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
            logger.info("[HttpSwrDbPlugin] persistToSwrStore", { swrEvent })
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
        const maxAttempts = this.bulkPersistRetryMaxAttempts;

        while (attempt < maxAttempts) {
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

            attempt++;
            if (attempt >= maxAttempts) break;

            const delayMs = Math.min(
                this.bulkPersistRetryBaseDelayMs * Math.pow(2, attempt - 1),
                this.bulkPersistRetryMaxDelayMs
            );
            logger.warn('[HttpSwrDbPlugin] bulkPersist failed, retrying', {
                collectionName,
                attempt,
                maxAttempts,
                delayMs,
                error: lastError,
            });
            await new Promise((r) => setTimeout(r, delayMs));
        }

        if (lastError != null && isAuthError(lastError)) {
            const authEvent = buildAuthErrorEvent(lastError, 'bulkPersist');
            if (authEvent) this.notifyAuthError(authEvent);
        }
        throw lastError ?? new Error('bulkPersist failed');
    }

    protected formatRequestBody(changes: SchemaPersistChanges<Record<string, unknown>>, _schema: CompiledSchema<UnknownRecord>) {
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

    /**
     * Persist to SWR store, then build one task per schema that has changes (queue add + POST payload).
     */
    private buildBulkPersistTasks(
        event: DbPluginBulkPersistEvent,
        headers: Record<string, string>
    ): BulkPersistTask[] {
        const tasks: BulkPersistTask[] = [];
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

            logger.debug('[HttpSwrDbPlugin] buildBulkPersistTasks', {
                event,
                schemaId,
                collectionName,
                adds: adds.length,
                updates: updates.length,
                removes: removes.length,
            });

            tasks.push({
                url: this.httpPlugin.collectionUrl(collectionName),
                headers,
                body: this.formatRequestBody(changes, schema),
                collectionName,
                schemaId,
                schema,
                changes,
                entitiesToRemoveFromQueue: [...entitiesToTrack, ...(removes as unknown[])],
            });
        }
        return tasks;
    }

    private async bulkPersistAsync(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        const result = event.operation.toResult();

        try {

            logger.info("[HttpSwrDbPlugin] HttpSwrDbPlugin.bulkPersistAsync() -> start", event);

            // We are subscribed to the SWR Store, not to the SWR Plugin,
            // so we need to manually send back an notification
            await this.persistToSwrStore(event);

            for (const [schemaId, changes] of event.operation) {
                if (changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get<UnknownRecord>(schemaId);
                this.notifySchemaSubscription(schema, {
                    adds: changes.adds,
                    removes: changes.removes,
                    updates: changes.updates.map((entity) => ({ entity, changeType: 'markedDirty' as const, delta: {} }))
                });
            }

            const headers = await this.httpPlugin.requestHeaders();
            const postTasks = this.buildBulkPersistTasks(event, headers);

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
