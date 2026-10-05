import {
    IDbPlugin,
    DbPluginQueryEvent,
    DbPluginBulkPersistEvent,
    DbPluginEvent,
    ITranslatedValue,
    joinInPlugin,
    reportRenamedProperties,
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
import { HttpStatusError, JsonWriteBatcher, RequestPacer, RequestTracker } from './httpUtils';
import { HttpQueryRunner, type ConditionalQueryResult } from './httpQueryRunner';
import { conflictOf, runWithOnError, statusOf, type ActionKit } from './requestFailures';
import { emitEvent, rejectedChangesOf, type HttpRequestError, type SyncEvent, type SyncHooks } from './syncHooks';

export interface HttpConnectionOptions {
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

    translateRemoteResponse?: (schema: CompiledSchema<UnknownRecord>, data: unknown) => unknown
}

export interface HttpPluginOptions extends HttpConnectionOptions, SyncHooks<HttpRequestError> { }

/** Re-export for consumers that need to type query serialization context. */
export type { QuerySerializationContext } from './queryParamHelpers';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 100;
export const DEFAULT_WRITE_BATCH_DELAY_MS = 25;

export class HttpDbPlugin implements IDbPlugin {
    protected readonly getUrl: (collectionName: string) => string;
    protected readonly getHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
    protected readonly querySerializationContext: QuerySerializationContext;
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
    private readonly queryRunner: HttpQueryRunner;
    private readonly onEvent?: (event: SyncEvent) => void;
    private readonly onError?: (error: HttpRequestError) => void;

    /** See `IDbPlugin.databaseName` and `HttpPluginOptions.databaseName`. */
    readonly databaseName: string;

    constructor(options: HttpPluginOptions) {
        this.databaseName = options.databaseName ?? "http";
        this.getUrl = options.getUrl;
        this.getHeaders = options.getHeaders;
        this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        this.pacer = new RequestPacer(options.minRequestIntervalMs ?? DEFAULT_MIN_REQUEST_INTERVAL_MS);
        this.writeBatcher = new JsonWriteBatcher(options.writeBatchDelayMs ?? DEFAULT_WRITE_BATCH_DELAY_MS);
        this.onEvent = options.onEvent;
        this.onError = options.onError;
        this.querySerializationContext = {
            ignoreQueryForCollections: options.ignoreQueryForCollections ?? [],
        };
        this.queryRunner = new HttpQueryRunner({
            requests: this.requests,
            pacer: this.pacer,
            requestTimeoutMs: this.requestTimeoutMs,
            translateRemoteResponse: options.translateRemoteResponse,
            requestHeaders: () => this.requestHeaders(),
        });
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
        const collectionName = event.operation.schema.collectionName;
        const settled = await runWithOnError({
            attempt: async () => {
                const result = await this.queryConditional(event, null);

                if (result.kind === 'modified') {
                    return result.data;
                }

                throw result.kind === 'failed' ? result.error : new HttpStatusError(304, 'Not Modified', null);
            },
            context: { operation: 'read', collectionName, method: 'GET', url: this.queryUrl(event), storeSource: false },
            onError: this.onError,
            actions: ({ retry, done }: ActionKit) => ({ retry, done }),
            unhandled: (kit: ActionKit) => kit.done(),
        });

        if (settled.outcome === 'success') {
            emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: 200 });
            done(PluginEventResult.success(event.id, settled.value));
            return;
        }

        emitEvent(this.onEvent, { type: 'read', ok: false, collectionName, status: statusOf(settled.error), error: settled.error });
        done(PluginEventResult.error(event.id, settled.error));
    }

    queryUrl<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): string {
        const { operation } = event;
        return buildUrlWithQuery(this.collectionUrl(operation.schema.collectionName), buildQueryParams(operation, this.querySerializationContext));
    }

    queryConditional<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>, ifNoneMatch: string | null): Promise<ConditionalQueryResult<TShape>> {
        const { operation } = event;

        reportRenamedProperties(operation.options);

        return this.queryRunner.run(event, this.queryUrl(event), ifNoneMatch);
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

                await this.postChanges(schema.collectionName, JSON.stringify({ adds, updates, removes }), { adds, updates, removes });

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

    private async postChanges(collectionName: string, body: string, changes: { adds: unknown[]; updates: unknown[]; removes: unknown[] }): Promise<void> {
        const url = this.collectionUrl(collectionName);
        const settled = await runWithOnError({
            attempt: () => this.postJson(url, body, collectionName),
            context: { operation: 'write', collectionName, method: 'POST', url, storeSource: false },
            onError: this.onError,
            actions: ({ retry, done }: ActionKit) => ({ retry, done }),
            unhandled: (kit: ActionKit) => kit.done(),
        });

        if (settled.outcome === 'success') {
            return;
        }

        const status = statusOf(settled.error);
        emitEvent(this.onEvent, {
            type: 'changes-rejected',
            collectionName,
            changes: rejectedChangesOf(changes),
            conflict: conflictOf(settled.error),
            status,
            error: settled.error,
        });
        throw settled.error;
    }

    destroy(_event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.writeBatcher.abortAll();
        this.requests.abortAll();
        done(PluginEventResult.success(_event.id));
    }
}
