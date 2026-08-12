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
 *
 * Hardening:
 * - Every request runs under an AbortController with a timeout; destroy() aborts in-flight requests.
 * - Headers are re-fetched per retry attempt so an expiring token cannot poison a retry loop.
 * - Backoff uses equal jitter and honors Retry-After.
 * - 401/403 notify onAuthError; a handler that resolves `true` earns exactly one retry with fresh headers.
 */

import {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    ITranslatedValue,
    joinInPlugin,
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
import { backoffDelayMs, HttpStatusError, isAuthStatus, JsonWriteBatcher, readRetryAfterMs, RequestPacer, RequestTracker } from './httpUtils';
import { buildAuthErrorEvent, type AuthErrorEvent, type AuthErrorHandler } from './auth';

export interface HttpPluginOptions {
    getUrl: (collectionName: string) => string;
    /**
     * See `IDbPlugin.databaseName`. `getUrl` is a caller-supplied function of collection name,
     * so there is no origin this plugin can read without inventing a collection to ask about —
     * hence a plain option with a shared default.
     *
     * Set it whenever an application talks to more than one HTTP backend over the same schema:
     * leaving both on the default makes them one database as far as subscriptions are
     * concerned, and each would be notified of the other's writes.
     */
    databaseName?: string;
    /** Headers for every request (e.g. Authorization). Can be async. Re-evaluated per retry attempt. */
    getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    /**
     * Collection names for which to ignore the query and select everything.
     * No filter, sort, skip, or take is sent; server returns full allowed set.
     */
    ignoreQueryForCollections?: string[];
    /**
     * Base delay (ms) for exponential backoff on query retry. When 0 or omitted, no retries (single attempt).
     * 401/403 never retried (except once after a successful re-auth); other failures retry with
     * jittered delay capped at queryRetryMaxDelayMs, honoring Retry-After.
     */
    queryRetryBaseDelayMs?: number;
    /** Max delay (ms) between query retries. Ignored when queryRetryBaseDelayMs is 0. */
    queryRetryMaxDelayMs?: number;
    /** Max number of query attempts (including initial). Default 10. 401/403 stop immediately. */
    queryRetryMaxAttempts?: number;
    /** Per-request timeout (ms); a hung connection fails instead of stalling forever. Default 30_000; 0 disables. */
    requestTimeoutMs?: number;
    /**
     * Minimum gap between requests to the same URL (reads) or collection (writes). Default 100.
     *
     * This plugin is the only place HTTP actually leaves the process, so pacing lives here: a
     * composing plugin cannot leak past it, and an app using this plugin directly gets the same
     * protection. Concurrent GETs for one URL collapse into a single request. 0 removes the gap;
     * calls for one key still never overlap.
     */
    minRequestIntervalMs?: number;
    /**
     * Quiet window (ms) used to batch writes to the same URL. Default 25.
     *
     * Every POST accepted during the window contributes its adds/updates/removes (and opIds) to
     * one request. The timer restarts when another write arrives, so a burst of ten saves becomes
     * one POST rather than ten serialized POSTs. Set to 0 to disable batching.
     */
    writeBatchDelayMs?: number;
    /**
     * Called when the remote returns 401 or 403 (query and bulkPersist; use event.context to
     * distinguish). Return/resolve `true` to signal re-auth succeeded — the failed operation
     * then retries once with fresh headers.
     */
    onAuthError?: AuthErrorHandler;

    translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown
}

/** Re-export for consumers that need to type query serialization context. */
export type { QuerySerializationContext } from './queryParamHelpers';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 100;
const DEFAULT_WRITE_BATCH_DELAY_MS = 25;

/** Result of a single HTTP query attempt (no retry decision). */
type QueryAttemptResult<TShape> =
    | { success: true; data: ITranslatedValue<TShape> }
    | { success: false; error: Error; isAuthError: boolean; status?: number; retryAfterMs?: number | null };

export class HttpDbPlugin implements IDbPlugin {
    protected readonly getUrl: (collectionName: string) => string;
    protected readonly getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    protected readonly querySerializationContext: QuerySerializationContext;
    protected readonly translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown;
    protected readonly requests = new RequestTracker();
    /**
     * Paces everything outbound. Reads share by URL — the URL *is* the request, so ten callers
     * wanting the same collection want one GET. Writes are first batched by URL, then serialized
     * here so batches never overlap or start closer together than the configured interval.
     */
    protected readonly pacer: RequestPacer;
    /** Coalesces logical writes before they enter the per-URL transport pacer. */
    private readonly writeBatcher: JsonWriteBatcher;
    protected readonly requestTimeoutMs: number;
    private readonly queryRetryBaseDelayMs: number;
    private readonly queryRetryMaxDelayMs: number;
    private readonly queryRetryMaxAttempts: number;
    private readonly onAuthError?: AuthErrorHandler;

    /** See `IDbPlugin.databaseName` and `HttpPluginOptions.databaseName`. */
    readonly databaseName: string;

    constructor(options: HttpPluginOptions) {
        this.databaseName = options.databaseName ?? "http";
        this.getUrl = options.getUrl;
        this.getHeaders = options.getHeaders;
        this.translateRemoteResponse = options.translateRemoteResponse;
        this.queryRetryBaseDelayMs = options.queryRetryBaseDelayMs ?? 0;
        this.queryRetryMaxDelayMs = options.queryRetryMaxDelayMs ?? 60_000;
        this.queryRetryMaxAttempts = options.queryRetryMaxAttempts ?? 10;
        this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        this.pacer = new RequestPacer(options.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS);
        this.writeBatcher = new JsonWriteBatcher(options.writeBatchDelayMs ?? DEFAULT_WRITE_BATCH_DELAY_MS);
        this.onAuthError = options.onAuthError;
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

    /**
     * Notifies onAuthError and reports whether the handler claims re-auth succeeded
     * (a truthy return/resolution). Handler exceptions are logged, never propagated.
     */
    async notifyAuthError(event: AuthErrorEvent | null): Promise<boolean> {
        if (event == null || this.onAuthError == null) {
            return false;
        }

        try {
            const outcome = await this.onAuthError(event);
            return outcome === true;
        } catch (err) {
            logger.error('[HttpDbPlugin] onAuthError threw', { error: err });
            return false;
        }
    }

    /**
     * Performs one GET request, parses and translates the response. Does not retry; returns success or failure with isAuthError.
     */
    private async executeQueryAttempt<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        url: string,
        attempt: number
    ): Promise<QueryAttemptResult<TShape>> {
        const { operation } = event;
        const { schema } = operation;
        const collectionName = schema.collectionName;

        try {
            logger.debug('[HttpDbPlugin] query', { collectionName, eventId: event.id, attempt: attempt + 1 });
            // Headers per attempt: a token refreshed mid-loop is picked up immediately
            const headers = await this.requestHeaders();
            const fetched = await this.getShared(url, headers);

            if (!fetched.ok) {
                const err = new HttpStatusError(fetched.status, fetched.statusText, fetched.retryAfterMs);
                const isAuthError = isAuthStatus(fetched.status);
                return {
                    success: false,
                    error: err,
                    isAuthError,
                    retryAfterMs: err.retryAfterMs,
                    ...(isAuthError && { status: fetched.status as 401 | 403 }),
                };
            }

            // Parsed per caller, from the shared TEXT. Sharing one parsed body would be cheaper
            // and wrong: JsonTranslator deserializes in place and sorts in place, so two callers
            // translating one object graph corrupt each other's results.
            const body = fetched.text === '' ? null : JSON.parse(fetched.text);
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
        /**
         * Interpretation 3 from `specs/joins.md`: two ordinary requests, paired here.
         *
         * The join option is NOT sent. `buildQueryParams` serializes filters, sort and the window
         * and ignores anything else, so each side goes out as the plain collection query it would
         * have been — which is the point: no server has to know what a join is. Both requests get
         * the full retry and re-auth treatment, because both are ordinary queries.
         *
         * The OUTER side goes first, so its keys narrow the inner request to rows that can actually
         * pair — the saving is largest here, where the inner read is a whole extra round trip.
         *
         * Forwarding the whole option and letting the server do the work is the eventual version,
         * and it waits on complete expression-tree serialization — a `PropertyExpression` still
         * holds a live `PropertyInfo`. Nothing about this design changes when that lands; the
         * option was built serializable from the start.
         */
        if (event.operation.options.has("join")) {
            joinInPlugin(event, (innerEvent, innerDone) => this.query(innerEvent, innerDone), done);
            return;
        }

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
        // A successful re-auth raises the ceiling by one rather than spending a retry, so the
        // promised single re-auth attempt happens even when queryRetryMaxAttempts is 1.
        let attemptsAllowed = Math.max(1, this.queryRetryMaxAttempts);
        let reauthAttempted = false;

        for (let attempt = 0; attempt < attemptsAllowed; attempt++) {
            const result = await this.executeQueryAttempt(event, url, attempt);

            if (result.success === true) {
                done(PluginEventResult.success(event.id, result.data));
                return;
            }

            const { error, isAuthError, status, retryAfterMs } = result;
            if (isAuthError) {
                const reauthSucceeded = await this.notifyAuthError(buildAuthErrorEvent(error, 'query'));

                if (reauthSucceeded && !reauthAttempted) {
                    reauthAttempted = true;
                    attemptsAllowed++;
                    logger.info('[HttpDbPlugin] re-auth succeeded, retrying query once', { collectionName });
                    continue;
                }

                logger.warn('[HttpDbPlugin] query auth error, not retrying', {
                    collectionName,
                    status,
                });
                done(PluginEventResult.error(event.id, error));
                return;
            }

            const hasMoreAttempts = attempt < attemptsAllowed - 1;
            if (this.queryRetryBaseDelayMs > 0 && hasMoreAttempts) {
                const delayMs = backoffDelayMs(attempt, this.queryRetryBaseDelayMs, this.queryRetryMaxDelayMs, retryAfterMs ?? null);
                logger.warn('[HttpDbPlugin] query failed, retrying', {
                    collectionName,
                    attempt: attempt + 1,
                    maxAttempts: attemptsAllowed,
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

        // Unreachable by design — every path above settles. It exists because the one thing
        // worse than a failed query is one that never answers: a caller awaiting done() would
        // hang forever, and the SWR plugin's cache-miss path would never fall back to the store.
        logger.error('[HttpDbPlugin] query exhausted its attempts without settling', { collectionName, eventId: event.id });
        done(PluginEventResult.error(event.id, new Error(`Query for ${collectionName} exhausted ${attemptsAllowed} attempts without a result`)));
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

                logger.debug('[HttpDbPlugin] bulkPersist', {
                    eventId: event.id,
                    schemaId,
                    collectionName: schema.collectionName,
                    adds: adds.length,
                    updates: updates.length,
                    removes: removes.length,
                });

                const url = this.collectionUrl(schema.collectionName);
                await this.postOnce(url, JSON.stringify({ adds, updates, removes }), schema.collectionName);

                const persistResult = result.get(schemaId);
                persistResult.adds.push(...adds);
                persistResult.updates.push(...updates);
                persistResult.removes.push(...removes);
            }
            if (schemaIds.length > 0) {
                logger.debug('[HttpDbPlugin] bulkPersist success', { eventId: event.id, schemaIds });
            }
            done(PluginEventResult.success(event.id, result));
        } catch (err) {
            logger.error('[HttpDbPlugin] bulkPersist failed', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        }
    }

    /**
     * One GET, shared with every concurrent caller asking for the same URL.
     *
     * Returns the response TEXT rather than a parsed body precisely because it is shared — see
     * the note at the parse site. Non-2xx responses are shared too: callers that would all have
     * failed together should not each spend a request finding that out.
     */
    protected getShared(url: string, headers: Record<string, string>): Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        retryAfterMs: number | null;
        text: string;
    }> {
        return this.pacer.share(`GET ${url}`, async () => {
            const res = await this.requests.raw(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json', ...headers },
            }, this.requestTimeoutMs) as {
                ok: boolean;
                status: number;
                statusText: string;
                headers?: { get?: (name: string) => string | null };
                json: () => Promise<unknown>;
                text?: () => Promise<string>;
            };

            if (!res.ok) {
                return { ok: false, status: res.status, statusText: res.statusText, retryAfterMs: readRetryAfterMs(res), text: '' };
            }

            // `text()` where the platform offers it; the fetch mocks in the suites only implement
            // `json()`, so fall back to re-serializing what they gave us
            const text = typeof res.text === 'function'
                ? await res.text()
                : JSON.stringify(await res.json());

            return { ok: true, status: res.status, statusText: res.statusText, retryAfterMs: null as number | null, text };
        });
    }

    /**
     * Enqueues a body for batching by URL, then POSTs the merged body through the pacer.
     *
     * Exposed because a composing plugin has no business opening its own sockets: this used to be
     * duplicated inside HttpSwrDbPlugin, with a second RequestTracker and no pacing at all, so
     * every write bypassed everything this class guarantees.
     */
    async postJson(url: string, body: string, _collectionName: string): Promise<unknown> {
        return this.writeBatcher.enqueue(`POST ${url}`, body, (batchedBody) =>
            this.pacer.serialize(`POST ${url}`, async () => {
                const headers = await this.requestHeaders();
                const res = await this.requests.fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...headers },
                    body: batchedBody,
                }, this.requestTimeoutMs) as { json: () => Promise<unknown> };

                try {
                    return await res.json();
                } catch {
                    return null;
                }
            })
        );
    }

    /** Calls accepted and not finished, including writes waiting in the batch window. */
    pendingRequestCount(): number {
        return this.pacer.pendingCount() + this.writeBatcher.pendingCount();
    }

    /** One POST with timeout; on 401/403, notifies onAuthError and retries once if re-auth succeeded. */
    private async postOnce(url: string, body: string, collectionName: string): Promise<void> {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                await this.postJson(url, body, collectionName);
                return;
            } catch (err) {
                if (err instanceof HttpStatusError && isAuthStatus(err.status) && attempt === 0) {
                    const reauthSucceeded = await this.notifyAuthError(buildAuthErrorEvent(err, 'bulkPersist'));
                    if (reauthSucceeded) {
                        logger.info('[HttpDbPlugin] re-auth succeeded, retrying POST once', { collectionName });
                        continue;
                    }
                }
                throw err;
            }
        }
    }

    destroy(_event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.writeBatcher.abortAll();
        this.requests.abortAll();
        done(PluginEventResult.success(_event.id));
    }
}
