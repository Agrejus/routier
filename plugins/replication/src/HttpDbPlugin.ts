/**
 * HTTP plugin for Routier sync. Talks to per-resource server endpoints.
 *
 * - GET {baseUrl}/{collectionName}?filter=&sort=&skip=&take= for reads
 * - POST {baseUrl}/{collectionName} with { adds, updates, removes } for writes
 *
 * Server exposes one controller per collection (e.g. api/data/bookings, api/data/users).
 * Use onGetUrl(collectionName) to override; default is ${baseUrl}/${collectionName}.
 *
 * - ignoreQueryForCollections: no query params sent; server returns full allowed set
 */

import {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    ITranslatedValue,
    JsonTranslator,
} from '@routier/core/plugins';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
} from '@routier/core/results';
import { BulkPersistResult } from '@routier/core/collections';
import { logger, UnknownRecord } from '@routier/core/utilities';
import { CompiledSchema } from '@routier/core';

import {
    buildQueryParams,
    buildUrlWithQuery,
    type QuerySerializationContext,
} from './queryParamHelpers';

export interface HttpPluginOptions {
    getUrl: (collectionName: string) => string;
    /** Headers for every request (e.g. Authorization). Can be async. */
    getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    /**
     * Collection names for which to ignore the query and select everything.
     * No filter, sort, skip, or take is sent; server returns full allowed set.
     */
    ignoreQueryForCollections?: string[];
    /**
     * Base delay (ms) for exponential backoff on query retry. When 0 or omitted, no retries (single attempt).
     * 401/403 never retried; other failures retry with delay = min(base * 2^attempt, queryRetryMaxDelayMs).
     */
    queryRetryBaseDelayMs?: number;
    /** Max delay (ms) between query retries. Ignored when queryRetryBaseDelayMs is 0. */
    queryRetryMaxDelayMs?: number;
    /** Max number of query attempts (including initial). Default 10. 401/403 stop immediately. */
    queryRetryMaxAttempts?: number;

    translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown
}

/** Re-export for consumers that need to type query serialization context. */
export type { QuerySerializationContext } from './queryParamHelpers';

/** Result of a single HTTP query attempt (no retry decision). */
type QueryAttemptResult<TShape> =
    | { success: true; data: ITranslatedValue<TShape> }
    | { success: false; error: Error; isAuthError: boolean; status?: number };

export class HttpDbPlugin implements IDbPlugin {
    protected readonly getUrl: (collectionName: string) => string;
    protected readonly getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    protected readonly querySerializationContext: QuerySerializationContext;
    protected readonly translateRemoteResponse: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown;
    private readonly queryRetryBaseDelayMs: number;
    private readonly queryRetryMaxDelayMs: number;
    private readonly queryRetryMaxAttempts: number;

    constructor(options: HttpPluginOptions) {
        this.getUrl = options.getUrl;
        this.getHeaders = options.getHeaders;
        this.translateRemoteResponse = options.translateRemoteResponse;
        this.queryRetryBaseDelayMs = options.queryRetryBaseDelayMs ?? 0;
        this.queryRetryMaxDelayMs = options.queryRetryMaxDelayMs ?? 60_000;
        this.queryRetryMaxAttempts = options.queryRetryMaxAttempts ?? 10;
        this.querySerializationContext = {
            ignoreQueryForCollections: options.ignoreQueryForCollections ?? [],
        };
    }

    /** Exposed for composing plugins (e.g. HttpSwrDbPlugin) that need to build request URLs. */
    collectionUrl(collectionName: string): string {
        return this.getUrl(collectionName);
    }

    /** Exposed for composing plugins that need to add auth or other headers to fetch/HTTP calls. */
    async requestHeaders(): Promise<Record<string, string>> {
        const h = this.getHeaders?.();
        return h instanceof Promise ? h : (h ?? {});
    }

    private getRetryDelayMs(attempt: number): number {
        return Math.min(
            this.queryRetryBaseDelayMs * Math.pow(2, attempt),
            this.queryRetryMaxDelayMs
        );
    }

    /**
     * Performs one GET request, parses and translates the response. Does not retry; returns success or failure with isAuthError.
     */
    private async executeQueryAttempt<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        url: string,
        headers: Record<string, string>,
        attempt: number
    ): Promise<QueryAttemptResult<TShape>> {
        const { operation } = event;
        const { schema } = operation;
        const collectionName = schema.collectionName;

        try {
            logger.debug('[HttpDbPlugin] query', { collectionName, eventId: event.id, attempt: attempt + 1 });
            const res = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...headers },
            });

            if (!res.ok) {
                const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
                const isAuthError = res.status === 401 || res.status === 403;
                return {
                    success: false,
                    error: err,
                    isAuthError,
                    ...(isAuthError && { status: res.status as 401 | 403 }),
                };
            }

            const body = await res.json();
            const rows =
                this.translateRemoteResponse != null
                    ? this.translateRemoteResponse(schema as CompiledSchema<UnknownRecord>, body)
                    : body;
            const translated = new JsonTranslator(operation).translate(rows);
            return { success: true, data: translated };
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            return { success: false, error, isAuthError: false };
        }
    }

    query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.handleQuery(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    protected async handleQuery<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): Promise<void> {
        const { operation } = event;
        const collectionName = operation.schema.collectionName;
        const params = buildQueryParams(operation, this.querySerializationContext);
        const url = buildUrlWithQuery(this.collectionUrl(collectionName), params);
        const headers = await this.requestHeaders();
        const maxAttempts = this.queryRetryMaxAttempts;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const result = await this.executeQueryAttempt(event, url, headers, attempt);

            if (result.success === true) {
                done(PluginEventResult.success(event.id, result.data));
                return;
            }

            const { error, isAuthError, status } = result;
            if (isAuthError) {
                logger.warn('[HttpDbPlugin] query auth error, not retrying', {
                    collectionName,
                    status,
                });
                done(PluginEventResult.error(event.id, error));
                return;
            }

            const hasMoreAttempts = attempt < maxAttempts - 1;
            if (this.queryRetryBaseDelayMs > 0 && hasMoreAttempts) {
                const delayMs = this.getRetryDelayMs(attempt);
                logger.warn('[HttpDbPlugin] query failed, retrying', {
                    collectionName,
                    attempt: attempt + 1,
                    maxAttempts,
                    delayMs,
                    error,
                });
                await new Promise((r) => setTimeout(r, delayMs));
                continue;
            }

            logger.error('[HttpDbPlugin] query failed', { collectionName, eventId: event.id, error });
            done(PluginEventResult.error(event.id, error));
            return;
        }
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        this.handleBulkPersist(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    protected async handleBulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        const result = event.operation.toResult();
        try {
            const schemaIds: number[] = [];
            for (const [schemaId, changes] of event.operation) {
                if (!changes?.hasItems) {
                    continue;
                }
                const schema = event.schemas.get(schemaId);
                if (!schema) {
                    continue;
                }
                schemaIds.push(schemaId);

                const adds = changes.adds;
                const updates = changes.updates.map((u) => u.entity);
                const removes = changes.removes;

                console.debug('[HttpDbPlugin] bulkPersist', {
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
                    console.warn('[HttpDbPlugin] bulkPersist HTTP error', {
                        collectionName: schema.collectionName,
                        status: res.status,
                        statusText: res.statusText,
                    });
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }

                const persistResult = result.get(schemaId);
                persistResult.adds.push(...adds);
                persistResult.updates.push(...updates);
                persistResult.removes.push(...removes);
            }
            if (schemaIds.length > 0) {
                console.debug('[HttpDbPlugin] bulkPersist success', { eventId: event.id, schemaIds });
            }
            done(PluginEventResult.success(event.id, result));
        } catch (err) {
            console.error('[HttpDbPlugin] bulkPersist failed', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }

    destroy(_event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        done(PluginEventResult.success(_event.id));
    }
}
