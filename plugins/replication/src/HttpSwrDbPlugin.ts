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
    Query,
    QueryOptionsCollection,
} from '@routier/core/plugins';
import type { CompiledSchema } from '@routier/core/schema';
import { ParamsFilter, toExpression } from '@routier/core/expressions';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
    Result,
} from '@routier/core/results';
import { BulkPersistResult, BulkPersistChanges } from '@routier/core/collections';
import { logger, uuid } from '@routier/core/utilities';
import { HttpDbPlugin, HttpPluginOptions } from './HttpDbPlugin';
import { assertIsNotNull } from '@routier/core';

const DEFAULT_MAX_AGE_MS = 60_000;

/** SWR-specific options for HttpSwrDbPlugin. */
export interface HttpSwrDbPluginOptions extends HttpPluginOptions {
    /** Max time (ms) to consider cache fresh; after this, the next read triggers a background revalidate. Default 60_000. */
    maxAgeMs?: number;
}

/** Cache metadata per schema (when we last revalidated). */
interface CacheMetadata {
    lastRevalidatedAt: number;
}

/**
 * Compares two result arrays using the schema's compare and compareIds.
 * Order-independent: treats as sets (match by id, then compare).
 */
function resultSetsEqual(
    schema: CompiledSchema<Record<string, unknown>>,
    cached: unknown[],
    source: unknown[]
): boolean {
    if (cached.length !== source.length) {
        return false;
    }
    const used = new Set<number>();
    for (const sourceItem of source) {
        let found = false;
        for (let i = 0; i < cached.length; i++) {
            if (used.has(i)) {
                continue;
            }
            const cachedItem = cached[i];
            if (
                schema.compareIds(sourceItem as never, cachedItem as never) &&
                schema.compare(sourceItem as never, cachedItem as never)
            ) {
                used.add(i);
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}

export class HttpSwrDbPlugin extends HttpDbPlugin {
    private readonly swrStore: IDbPlugin;
    private readonly maxAgeMs: number;
    private readonly cacheMetadata = new Map<number, CacheMetadata>();
    private readonly revalidateInFlight = new Map<number, Promise<void>>();

    constructor(
        swrStore: IDbPlugin,
        options: HttpSwrDbPluginOptions,
    ) {
        super(options);
        this.swrStore = swrStore;
        this.maxAgeMs = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    }

    private getCacheKey<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): number {
        return event.operation.schema.id;
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
     * Persist translated result to the SWR store as upsert: for each incoming row we know id(s)
     * from the schema; we select by those ids from the store, then add if missing, update if present.
     */
    private persistToStore<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        translated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
        const value = translated.value;
        const rows: any[] = [];

        if (Array.isArray(value)) {
            rows.push(...value);
        } else if (typeof value === "object") {
            rows.push(value);
        }

        console.debug('[HttpSwrDbPlugin] persistToStore start', {
            collectionName: schema.collectionName,
            rowCount: rows.length,
        });

        const applyBulkPersist = (
            adds: unknown[],
            updates: { entity: unknown; changeType: 'propertiesChanged'; delta: Record<string, unknown> }[]
        ) => {
            const bulkChanges = new BulkPersistChanges();
            const schemaChanges = bulkChanges.resolve(schema.id);
            schemaChanges.adds = adds as never[];
            schemaChanges.updates = updates as never[];

            const swrEvent = {
                id: uuid(8),
                schemas: event.schemas,
                operation: bulkChanges,
                source: HttpSwrDbPlugin.name,
                action: 'persist' as const,
                reason: 'revalidate',
            };

            console.debug('[HttpSwrDbPlugin] persistToStore', {
                collectionName: schema.collectionName,
                adds: adds.length,
                updates: updates.length,
            });
            this.swrStore.bulkPersist(swrEvent, (persistResult) => {
                if (persistResult.ok === Result.ERROR) {
                    console.error('[HttpSwrDbPlugin] persistToStore failed', {
                        collectionName: schema.collectionName,
                        error: persistResult.error,
                    });
                    done(PluginEventResult.error(event.id, persistResult.error));
                    return;
                }
                done(PluginEventResult.success(event.id, translated));
            });
        };

        if (rows.length === 0) {
            console.debug('[HttpSwrDbPlugin] persistToStore no rows', { collectionName: schema.collectionName });
            applyBulkPersist([], []);
            return;
        }
        const options = new QueryOptionsCollection<TShape>();

        for (const idProperty of schema.idProperties) {

            const idPropName = idProperty.name;
            const ids = [...new Set(rows.map((r) => idProperty.getValue(r)))]

            assertIsNotNull(ids);

            const filter: ParamsFilter<any, { ids: any[], idPropName: string }> = ([x, p]) => p.ids.includes((x[p.idPropName]))
            const expression = toExpression(
                schema,
                filter,
                { ids, idPropName }
            );

            options.add('filter', {
                params: { ids, idPropName },
                filter,
                expression,
            });
        }

        const byIdsQuery = new Query(options, event.operation.schema);
        const byIdsEvent: DbPluginQueryEvent<TRoot, TShape> = {
            ...event,
            id: uuid(8),
            source: HttpSwrDbPlugin.name,
            action: 'query' as const,
            reason: 'revalidate-upsert',
            operation: byIdsQuery,
        };

        console.debug('[HttpSwrDbPlugin] persistToStore querying store by ids', {
            collectionName: schema.collectionName,
            idPropertyCount: schema.idProperties.length,
        });
        this.swrStore.query(byIdsEvent, (queryResult) => {
            if (queryResult.ok === Result.ERROR) {
                logger.error('[HttpSwrDbPlugin] persistToStore query-by-ids failed', {
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
            const existingById = new Map<ReturnType<CompiledSchema<Record<string, unknown>>['getIds']>[0], unknown>();
            for (const e of existingArr) {
                existingById.set(schema.getIds(e as never)[0], e);
            }

            const adds = rows.filter((r) => !existingById.has(schema.getIds(r as never)[0]));
            const updates = rows
                .filter((r) => {
                    const id = schema.getIds(r as never)[0];
                    const existing = existingById.get(id);
                    return existing != null && !schema.compare(r as never, existing as never);
                })
                .map((entity) => ({ entity, changeType: 'propertiesChanged' as const, delta: {} as Record<string, unknown> }));

            logger.debug('[HttpSwrDbPlugin] persistToStore classified', {
                collectionName: schema.collectionName,
                existingCount: existingArr.length,
                adds: adds.length,
                updates: updates.length,
            });
            applyBulkPersist(adds, updates);
        });
    }

    /**
     * Trigger a background revalidate: fetch from source, compare, optionally persist and notify.
     * Deduplicates in-flight revalidates per cache key.
     */
    private startRevalidate<TRoot extends {}, TShape>(
        cacheKey: number,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        const existing = this.revalidateInFlight.get(cacheKey);
        if (existing) {
            console.debug('[HttpSwrDbPlugin] revalidate deduplicated', { collectionName, cacheKey });
            void existing;
            return;
        }

        console.debug('[HttpSwrDbPlugin] revalidate started', { collectionName, cacheKey });
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
            super.handleQuery(event, (sourceResult) => {
                if (sourceResult.ok === Result.ERROR) {
                    console.warn('[HttpSwrDbPlugin] revalidate source query failed', { collectionName, cacheKey, error: sourceResult.error });
                    resolve();
                    return;
                }
                const schema = event.operation.schema as CompiledSchema<Record<string, unknown>>;
                const cachedArr = (cachedTranslated.value as unknown) as unknown[];
                const sourceArr = (sourceResult.data.value as unknown) as unknown[];
                const same = resultSetsEqual(schema, cachedArr, sourceArr);
                this.setRevalidated(cacheKey);
                if (same) {
                    console.debug('[HttpSwrDbPlugin] revalidate unchanged', { collectionName, cacheKey });
                } else {
                    console.debug('[HttpSwrDbPlugin] revalidate updated, persisting to store', { collectionName, cacheKey, count: sourceArr.length });
                    this.persistToStore(
                        event,
                        sourceResult.data,
                        done
                    );
                }
                resolve();
            });
        });
    }

    protected override async handleQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const cacheKey = this.getCacheKey(event);
        const collectionName = event.operation.schema.collectionName;

        this.swrStore.query(event, (swrResponse) => {
            if (swrResponse.ok === Result.ERROR) {
                console.warn('[HttpSwrDbPlugin] swrStore query failed', { collectionName, error: swrResponse.error });
                done(swrResponse);
                return;
            }

            const hasData =
                swrResponse.data?.value != null &&
                Array.isArray(swrResponse.data.value) &&
                swrResponse.data.value.length > 0;

            if (!hasData) {
                console.debug('[HttpSwrDbPlugin] cache miss, fetching from source', { collectionName });
                super.handleQuery(event, (sourceResult) => {
                    if (sourceResult.ok === Result.ERROR) {
                        done(sourceResult);
                        return;
                    }
                    this.setRevalidated(cacheKey);
                    this.persistToStore(
                        event,
                        sourceResult.data,
                        done
                    );
                });
                return;
            }

            const count = (swrResponse.data.value as unknown[]).length;
            console.debug('[HttpSwrDbPlugin] cache hit', { collectionName, count, stale: this.isStale(cacheKey) });
            done(PluginEventResult.success(event.id, swrResponse.data));

            if (this.isStale(cacheKey)) {
                this.startRevalidate(cacheKey, event, swrResponse.data, done);
            }
        });
    }

    protected override async handleBulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        const result = event.operation.toResult();
        try {
            for (const [schemaId, changes] of event.operation) {
                if (!changes?.hasItems) {
                    continue;
                }
                const schema = event.schemas.get(schemaId);
                if (!schema) {
                    continue;
                }

                const adds = (changes.adds ?? []) as unknown[];
                const updates = (changes.updates ?? []).map(
                    (u: { entity?: unknown }) => u?.entity ?? u
                ) as unknown[];
                const removes = (changes.removes ?? []) as unknown[];

                console.debug('[HttpSwrDbPlugin] bulkPersist', {
                    eventId: event.id,
                    schemaId,
                    collectionName: schema.collectionName,
                    adds: adds.length,
                    updates: updates.length,
                    removes: removes.length,
                });

                const url = this.collectionUrl(schema.collectionName);
                const headers = await this.requestHeaders();
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: JSON.stringify({ adds, updates, removes }),
                });
                if (!res.ok) {
                    console.warn('[HttpSwrDbPlugin] bulkPersist HTTP error', {
                        collectionName: schema.collectionName,
                        status: res.status,
                        statusText: res.statusText,
                    });
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const persistResult = result.get(schemaId);
                (persistResult.adds as unknown[]).push(...adds);
                (persistResult.updates as unknown[]).push(...updates);
                (persistResult.removes as unknown[]).push(...removes);
            }
            done(PluginEventResult.success(event.id, result));
        } catch (err) {
            console.error('[HttpSwrDbPlugin] bulkPersist failed', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }
}
