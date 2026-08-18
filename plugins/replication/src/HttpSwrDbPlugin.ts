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
    IQuery,
    Query,
    QueryOptionsCollection,
    QueryOptionName,
} from '@routier/core/plugins';
import type { CompiledSchema, SchemaId, SubscriptionChanges } from '@routier/core/schema';
import { HashType } from '@routier/core/schema';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
    type PluginEventResultType,
    Result,
} from '@routier/core/results';
import { BulkPersistResult, BulkPersistChanges, SchemaCollection, SchemaPersistChanges } from '@routier/core/collections';
import { logger, UnknownRecord, uuid } from '@routier/core/utilities';
import { HttpDbPlugin, HttpPluginOptions } from './HttpDbPlugin';
import { assertIsNotNull } from '@routier/core';

import { buildAuthErrorEvent } from './auth';
import { UnsyncedQueue, type DeadLetteredChange, type QueuedChange, type UnsyncedFlushUnit, type UnsyncedQueueRow } from './UnsyncedQueue';
import { buildUpdatePayload, entityIdKey, resultSetsEqual } from './swrUtils';
import { SWR_DEFAULTS } from './constants';
import { buildQueryParams } from './queryParamHelpers';
import { backoffDelayMs, HttpStatusError, isAuthStatus, isConflictStatus, isPermanentStatus, KeyedMutex, RequestPacer } from './httpUtils';

// Re-export for consumers
export type { AuthErrorEvent } from './auth';

/** What a flush moved. Returned by `syncNow()` and passed to `onSync`. */
export interface SyncOutcome {
    /** Changes the server accepted and the queue dropped. */
    flushed: number;
    /** Changes that failed transiently and are still queued. */
    failed: number;
    /** Changes the server permanently rejected; reported via onSyncDeadLetter. */
    deadLettered: number;
}

/**
 * When the plugin syncs on its own.
 *
 * Automatic is the default and needs no configuration: unsynced changes retry on a backing-off
 * timer, and immediately when the browser regains connectivity. Every field here is an override
 * for an app that wants a different cadence — or none at all, driving `syncNow()` itself.
 */
export interface AutoSyncOptions {
    /**
     * Delay before the first background flush, doubling after each unproductive attempt.
     * Default 1000. (For back-compat this falls back to `bulkPersistRetryBaseDelayMs` when that
     * is set and this is not; the two used to be the same number.)
     */
    delayMs?: number;
    /** Ceiling for the backing-off delay. Default 60_000. */
    maxDelayMs?: number;
    /**
     * Flush the moment the platform reports connectivity is back, instead of waiting out the
     * current delay. Default true; ignored where there is no `online` event to listen for.
     */
    onOnline?: boolean;
    /**
     * Minimum gap between the *starts* of two flushes. Default 250; 0 disables the wait
     * (flushes still never overlap). Not applied when `autoSync` is `false` — see below.
     *
     * Guards against the app talking to itself too fast: a double-clicked "Sync now", a
     * connection that flaps, or a manual flush landing on top of a background one. Triggers
     * inside the window coalesce into a single follow-up flush rather than each becoming a
     * round of requests.
     */
    minIntervalMs?: number;
}

/** SWR-specific options for HttpSwrDbPlugin. */
export interface HttpSwrDbPluginOptions extends HttpPluginOptions {
    /**
     * Background sync policy. Omit for the automatic default (retry on a backing-off timer plus
     * an immediate flush when connectivity returns), pass an object to tune it, or pass `false`
     * to turn it off entirely and drive `syncNow()` yourself.
     *
     * Turning it off does not turn off *queueing* — changes are still recorded durably before
     * every ack. It only means nothing replays them until you ask.
     */
    autoSync?: false | AutoSyncOptions;
    /**
     * Called after every flush, automatic or manual, with what it moved. Use it for a
     * "last synced" indicator or to refresh a pending count.
     */
    onSync?: (outcome: SyncOutcome) => void;
    /**
     * Whether a save also POSTs immediately, or is left to the batching flush. Default true.
     *
     * `true` is the low-latency path: the write enters HttpDbPlugin's short batching window
     * immediately, and its response can be reconciled through `translatePersistResponse`.
     * Rapid writes to the same URL share one POST by default (`writeBatchDelayMs` controls the
     * window), while an isolated write pays only that short delay.
     *
     * `false` acknowledges locally, records the change durably as always, and leaves delivery to
     * the paced queue flush — one request per collection per flush, however many saves went into
     * it. This adds up to `autoSync.delayMs` of latency and skips echo reconciliation (the flush
     * has no schema to translate with), but is useful when delivery should happen only on the
     * background/manual sync cadence.
     *
     * With `autoSync: false` as well, nothing is delivered until you call `syncNow()`.
     */
    postOnPersist?: boolean;
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
     * Called when background revalidate fails (e.g. offline, network error). Use for logging or toasts.
     * Revalidate failures are not reported back via done(); the UI keeps showing cached data.
     */
    onRevalidateError?: (error: Error, context: { collectionName: string; cacheKey?: string }) => void;
    /**
     * Called when the queue permanently gives up on changes: the server rejected them with a
     * non-retryable status (4xx other than 401/403/408/429). Dead-lettered changes stop
     * flushing and stop shielding their entities from revalidate — surface them to the user.
     */
    onSyncDeadLetter?: (changes: DeadLetteredChange[], error: Error) => void;
    /**
     * Called when the server answers 409 Conflict for a change. Informational — the change
     * dead-letters (409 is non-retryable) and the server copy wins on the next revalidate.
     */
    onConflict?: (context: { collectionName: string; entities: unknown[]; error: Error }) => void;
    /**
     * Reconciles the POST response into the SWR store: given the response body, return the
     * canonical entities the server echoed (or null to skip). Fixes server-assigned ids and
     * timestamps drifting from the optimistic local copy.
     */
    translatePersistResponse?: (schema: CompiledSchema<UnknownRecord>, responseBody: unknown) => unknown[] | null;
    /**
     * IDbPlugin to use for persisting the unsynced queue (e.g. same as swrStore). No datastore required.
     * The queue is stored via query/bulkPersist in a reserved collection (_routier_unsynced).
     *
     * Required: UnsyncedQueue has no default store. Pass a durable plugin to survive a
     * refresh with unsynced items intact, or a MemoryPlugin to accept losing them.
     */
    unsyncedQueueStore: IDbPlugin;
}

interface CacheMetadata {
    lastRevalidatedAt: number;
}

/**
 * Resolves the background-sync policy, or null when the caller passed `autoSync: false`.
 *
 * `delayMs` falls back to `bulkPersistRetryBaseDelayMs` because those used to be one number:
 * the delay between POST attempts *was* the background flush cadence. They are unrelated
 * concerns — how patiently a single request retries versus how often the queue drains — and
 * conflating them meant you could not slow the loop down without also slowing every retry.
 * The fallback keeps existing configurations behaving exactly as before.
 */
function resolveAutoSync(options: HttpSwrDbPluginOptions): Required<AutoSyncOptions> | null {
    if (options.autoSync === false) {
        return null;
    }

    const overrides = options.autoSync ?? {};

    return {
        delayMs: overrides.delayMs ?? options.bulkPersistRetryBaseDelayMs ?? SWR_DEFAULTS.bulkPersistRetryBaseDelayMs,
        maxDelayMs: overrides.maxDelayMs ?? options.bulkPersistRetryMaxDelayMs ?? SWR_DEFAULTS.bulkPersistRetryMaxDelayMs,
        onOnline: overrides.onOnline ?? true,
        minIntervalMs: overrides.minIntervalMs ?? DEFAULT_MIN_FLUSH_INTERVAL_MS,
    };
}

const DEFAULT_MIN_FLUSH_INTERVAL_MS = 250;

/** Result of comparing incoming rows with store + unsynced set during revalidate. */
interface RevalidateClassification {
    adds: unknown[];
    updates: { entity: unknown; changeType: 'markedDirty'; delta: Record<string, unknown> }[];
    removes: unknown[];
}

/** Single-schema task for bulk persist: POST payload + data needed to finalize on success. */
type StructuredBatchRejection =
    | { scope: 'batch' }
    | { scope: 'items'; rejectedOpIds: Set<string> };

interface BulkPersistTask {
    url: string;
    body: string;
    collectionName: string;
    schemaId: SchemaId;
    schema: CompiledSchema<UnknownRecord>;
    changes: SchemaPersistChanges<UnknownRecord>;
    /** Everything queued for this task; dequeued when the POST succeeds. */
    queuedChanges: QueuedChange[];
}

export class HttpSwrDbPlugin implements IDbPlugin {
    private readonly httpPlugin: HttpDbPlugin;
    private readonly swrStore: IDbPlugin;
    private readonly maxAgeMs: number;
    private readonly bulkPersistRetryBaseDelayMs: number;
    private readonly bulkPersistRetryMaxDelayMs: number;
    private readonly bulkPersistRetryMaxAttempts: number;
    private readonly onRevalidateError?: (error: Error, context: { collectionName: string; cacheKey?: string }) => void;
    private readonly onSyncDeadLetter?: (changes: DeadLetteredChange[], error: Error) => void;
    private readonly onConflict?: (context: { collectionName: string; entities: unknown[]; error: Error }) => void;
    private readonly translatePersistResponse?: (schema: CompiledSchema<UnknownRecord>, responseBody: unknown) => unknown[] | null;
    private readonly unsyncedQueue: UnsyncedQueue;
    /**
     * Schemas this plugin has been handed, keyed by collection name.
     *
     * The background flush has queue rows, not an event — so it had no `CompiledSchema` and no
     * `SchemaCollection`, and therefore could not reconcile the echo the server returned. That
     * was recorded as a limitation (handoff §7d). It does not have to be one: the plugin sees
     * every schema it will ever need on the first query or save for that collection, so it
     * remembers them and the flush looks them up.
     *
     * Remembering rather than requiring them up front keeps the constructor unchanged, and a
     * collection that has never been read or written has nothing queued to flush either.
     */
    private readonly schemasByCollection = new Map<string, CompiledSchema<UnknownRecord>>();
    private lastSeenSchemas: SchemaCollection | null = null;

    /** Serializes SWR-store mutations per collection so a revalidate diff can never interleave with a user write. */
    private readonly storeMutex = new KeyedMutex();
    /** Resolved background-sync policy; null when the caller turned it off. */
    private readonly autoSync: Required<AutoSyncOptions> | null;
    private readonly onSync?: (outcome: SyncOutcome) => void;
    /** Flush immediately when connectivity returns instead of waiting out the backoff. */
    private readonly onOnline = () => {
        void this.syncNow().catch((err) => logger.warn('[HttpSwrDbPlugin] online flush failed', { error: err }));
    };
    /**
     * Coalesces the WORK behind a cache miss — fetch plus store write — so five components asking
     * for a cold collection do not each write it to the store. The request itself is paced one
     * level down, in HttpDbPlugin, which is the only thing that opens a socket.
     */
    private readonly missPacer = new RequestPacer();
    private readonly postOnPersist: boolean;
    /**
     * Instance-scoped so two plugins (different servers, different auth) never share
     * staleness state; keyed by schema + serialized query so differently-filtered
     * queries on one collection each track their own freshness.
     */
    private readonly cacheMetadata = new Map<string, CacheMetadata>();
    /** The pending background-sync retry, so `destroy` can stop the chain. */
    private backgroundSyncTimer: ReturnType<typeof setTimeout> | null = null;
    /** The running flush, so nothing starts a second one alongside it. */
    private flushInFlight: Promise<SyncOutcome> | null = null;
    /** The single follow-up flush that every mid-flush caller shares. */
    private flushQueued: Promise<SyncOutcome> | null = null;
    private lastFlushStartedAt = 0;
    private isDestroyed = false;

    /**
     * The REMOTE's name. The swr store is a local cache of it, so two instances backed by one
     * server are one database for subscription purposes — which is what makes their stores
     * see each other's writes.
     */
    get databaseName(): string {
        return this.httpPlugin.databaseName;
    }

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
        this.onRevalidateError = options?.onRevalidateError;
        this.onSyncDeadLetter = options?.onSyncDeadLetter;
        this.onConflict = options?.onConflict;
        this.translatePersistResponse = options?.translatePersistResponse;
        this.unsyncedQueue = new UnsyncedQueue(options.unsyncedQueueStore);
        this.onSync = options?.onSync;
        this.postOnPersist = options?.postOnPersist ?? true;
        this.autoSync = resolveAutoSync(options);

        if (this.autoSync != null) {
            this.startBackgroundSync();

            if (this.autoSync.onOnline && typeof globalThis.addEventListener === 'function') {
                globalThis.addEventListener('online', this.onOnline);
            }
        }
    }

    /**
     * Flushes everything unsynced now, instead of waiting for the background timer.
     *
     * The manual half of the sync story: a "Sync now" button, a flush before logout, or the
     * whole mechanism when `autoSync: false`. Safe to call at any time and safe to call
     * concurrently with the background loop — each change carries an idempotency key, so a
     * server that tracks them applies a double-send once.
     */
    syncNow(): Promise<SyncOutcome> {
        return this.requestFlush();
    }

    /**
     * How many changes are waiting to reach the server. 0 means everything acked locally has
     * also been confirmed remotely. Dead-lettered changes are not counted — see `deadLetters()`.
     */
    pendingCount(): Promise<number> {
        return this.unsyncedQueue.getPendingCount();
    }

    /**
     * Changes the queue has given up on, because the server rejected them in a way retrying
     * cannot fix. These are also reported as they happen through `onSyncDeadLetter`; this is
     * the "what is still broken" view for a screen the user can act on.
     */
    deadLetters(): Promise<UnsyncedQueueRow[]> {
        return this.unsyncedQueue.getDeadLetters();
    }

    /**
     * Puts dead-lettered changes back in the queue and flushes. Returns how many were revived.
     *
     * For after the reason they failed is gone — the record was corrected, a bad deploy was
     * rolled back. Never automatic: the server already said this cannot work.
     */
    async retryDeadLetters(): Promise<{ revived: number; outcome: SyncOutcome }> {
        const revived = await this.unsyncedQueue.revive(await this.unsyncedQueue.getDeadLetters());

        if (revived === 0) {
            return { revived, outcome: { flushed: 0, failed: 0, deadLettered: 0 } };
        }

        logger.info('[HttpSwrDbPlugin] retrying dead-lettered changes', { revived });
        return { revived, outcome: await this.syncNow() };
    }

    query<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        /**
         * Refused, not attempted — and this is the honest answer rather than a missing feature.
         *
         * This plugin answers a read from its local store and revalidates against the remote,
         * merging the two. A join makes both halves of that incoherent: the local store would
         * return TUPLES (its own plugin can join), the remote returns rows, and merging one into
         * the other produces something that is neither. The cache key would collide too — it is
         * built from the serialized query, and the join option does not serialize, so two
         * different joins over one collection would share an entry.
         *
         * `HttpDbPlugin` joins fine. Use it directly for a joined read, or project the pair you
         * need with `.map()` on a plain query.
         */
        if (event.operation.options.has("join")) {
            done(PluginEventResult.error(event.id, new Error(
                "HttpSwrDbPlugin cannot execute a join: it merges a local read with a remote one, and the two sides " +
                "would disagree about whether a row is an entity or a pair.  Use HttpDbPlugin for joined reads."
            )));
            return;
        }

        this.queryAsync(event, done).catch((err) => {
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
        });
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {
        // bulkPersistAsync owns every done() call, including pre-ack failures; a
        // rejection here would mean a bug, and calling done() again could double-ack
        this.bulkPersistAsync(event, done).catch((err) => {
            logger.error('[HttpSwrDbPlugin] bulkPersistAsync rejected unexpectedly', { eventId: event.id, error: err });
        });
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.stopBackgroundSync();

        if (typeof globalThis.removeEventListener === 'function') {
            globalThis.removeEventListener('online', this.onOnline);
        }

        // No abort call of its own: every request this plugin makes goes through httpPlugin, whose
        // destroy aborts what is in flight
        this.httpPlugin.destroy(event, done);
    }

    /**
     * Retries flushing unsynced items on a timer using bulkPersist retry delays.
     *
     * The chain reschedules itself forever, which is the intent — there is always more to
     * retry later. Two things follow from that, and neither used to be true:
     *
     *  - **The timer is unref'd.** A pending retry is not a reason to keep the process
     *    alive. Without it, constructing this plugin means Node can never exit on its own:
     *    every test run needs `--forceExit`, and a CLI using it hangs after its work is
     *    done. `unref` is Node-only, so it is called defensively — in a browser the timer
     *    does not hold anything open in the first place.
     *  - **`destroy` stops it.** Nothing else could: the handle was a local, so the chain
     *    outlived the plugin that started it.
     */
    private startBackgroundSync(): void {
        const policy = this.autoSync;
        if (policy == null) {
            return;
        }

        const run = (attempt: number) => {
            if (this.isDestroyed) {
                return;
            }

            const delayMs = Math.min(policy.delayMs * Math.pow(2, attempt), policy.maxDelayMs);

            this.backgroundSyncTimer = setTimeout(() => {
                void this.requestFlush()
                    .then((outcome) => {
                        // A flush that actually moved data means the remote is reachable
                        // again — reset the backoff so follow-up work syncs promptly
                        run(outcome.flushed > 0 && outcome.failed === 0 ? 0 : attempt + 1);
                    })
                    .catch((err) => {
                        logger.warn('[HttpSwrDbPlugin] background flushUnsynced failed', { error: err });
                        run(attempt + 1);
                    });
            }, delayMs);

            (this.backgroundSyncTimer as { unref?: () => void }).unref?.();
        };
        run(0);
    }

    /**
     * The only way a flush is ever started. Two flushes never overlap, and a burst of triggers
     * costs one extra flush rather than one per trigger.
     *
     * Three things can ask for a flush — the background timer, the `online` event, and
     * `syncNow()` — and nothing stopped them coinciding. Two flushes read the same queue rows
     * and POST all of them again: idempotency keys keep the server's *data* right, so the only
     * symptom is doubled traffic, which is the app attacking itself.
     *
     * A caller that arrives mid-flush is NOT given the running flush to await. It may have just
     * enqueued a change the running flush has already read past, and answering with a flush that
     * could not have included it would be a lie — "Sync now" has to mean this write went out. It
     * gets the follow-up instead, and every caller in that window shares that one follow-up.
     */
    private requestFlush(): Promise<SyncOutcome> {
        if (this.flushInFlight == null) {
            return this.startFlush();
        }

        this.flushQueued ??= this.flushInFlight
            .catch((): void => undefined)
            .then(() => {
                this.flushQueued = null;
                return this.startFlush();
            });

        return this.flushQueued;
    }

    private startFlush(): Promise<SyncOutcome> {
        const attempt = (async (): Promise<SyncOutcome> => {
            // The interval is part of the auto-sync policy, so `autoSync: false` has none: the
            // caller has taken delivery over, and silently delaying the flush they asked for
            // would be worse than the traffic it saves. They still never get two at once.
            const minIntervalMs = this.autoSync?.minIntervalMs ?? 0;
            const sinceLast = Date.now() - this.lastFlushStartedAt;

            if (minIntervalMs > 0 && sinceLast < minIntervalMs) {
                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, minIntervalMs - sinceLast);
                    (timer as { unref?: () => void }).unref?.();
                });
            }

            if (this.isDestroyed) {
                return { flushed: 0, failed: 0, deadLettered: 0 };
            }

            this.lastFlushStartedAt = Date.now();
            return this.flushUnsynced();
        })();

        this.flushInFlight = attempt;
        void attempt.catch((): void => undefined).then(() => {
            if (this.flushInFlight === attempt) {
                this.flushInFlight = null;
            }
        });

        return attempt;
    }

    /** Ends the background-sync chain. Idempotent. */
    private stopBackgroundSync(): void {
        this.isDestroyed = true;

        if (this.backgroundSyncTimer != null) {
            clearTimeout(this.backgroundSyncTimer);
            this.backgroundSyncTimer = null;
        }
    }

    /**
     * Reissue POST for unsynced items using data stored in the queue (no schema cache, no SWR query).
     * Replays each change with its original kind — a queued remove goes back out as a remove,
     * not an add. When a batch fails PERMANENTLY (non-retryable 4xx), each per-entity unit is
     * retried alone to isolate the poison item: units the server accepts flush, units it
     * permanently rejects dead-letter, everything else stays queued.
     * Returns counts so the background loop can reset its backoff after progress.
     */
    private async flushUnsynced(): Promise<SyncOutcome> {
        const outcome: SyncOutcome = { flushed: 0, failed: 0, deadLettered: 0 };
        const collections = await this.unsyncedQueue.getUnsyncedCollections();
        if (collections.length === 0) {
            this.notifySync(outcome);
            return outcome;
        }

        for (const collectionName of collections) {
            const payload = await this.unsyncedQueue.getUnsyncedEntitiesForFlush(collectionName);
            if (payload.rows.length === 0) continue;

            const body = JSON.stringify({
                adds: payload.adds,
                updates: payload.updates,
                removes: payload.removes,
                meta: { opIds: payload.opIds },
            });
            const url = this.httpPlugin.collectionUrl(collectionName);

            try {
                const responseBody = await this.postWithRetry(url, body, collectionName);
                await this.unsyncedQueue.removeRows(payload.rows);
                outcome.flushed += payload.units.length;

                // The flush echoes back like any other POST; it just had no schema to
                // translate with until the plugin started remembering them (§7d).
                await this.reconcileFlushResponse(collectionName, responseBody).catch((err) =>
                    logger.warn('[HttpSwrDbPlugin] flush echo reconciliation failed', { collectionName, error: err })
                );
            } catch (err) {
                if (err instanceof HttpStatusError && isPermanentStatus(err.status)) {
                    const structured = this.parseStructuredBatchRejection(err);
                    const resolved = structured == null
                        ? await this.isolatePoisonUnits(collectionName, url, payload.units)
                        : await this.applyStructuredBatchRejection(collectionName, url, payload.units, structured, err);
                    outcome.flushed += resolved.flushed;
                    outcome.failed += resolved.failed;
                    outcome.deadLettered += resolved.deadLettered;
                } else {
                    // Transient (network/5xx/timeout): stays queued; next tick retries
                    await this.unsyncedQueue.recordFailedAttempt(payload.rows).catch((writeError): void =>
                        logger.warn('[HttpSwrDbPlugin] could not record a failed attempt', { collectionName, error: writeError }));
                    outcome.failed += payload.units.length;
                }
            }
        }

        this.notifySync(outcome);
        return outcome;
    }

    private notifySync(outcome: SyncOutcome): void {
        try {
            this.onSync?.(outcome);
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] onSync threw', { error: err });
        }
    }

    /**
     * Optional server contract for avoiding N-request poison isolation:
     *
     *  - `{ rejectionScope: "batch" }` means no item can succeed (authorization/business rule);
     *    dead-letter the whole batch immediately.
     *  - `{ rejectedOpIds: ["..."] }` identifies poison operations. Dead-letter those and retry
     *    every unlisted operation together once.
     *
     * An unstructured legacy 4xx still uses per-item isolation because silently discarding valid
     * writes would be worse than the extra traffic.
     */
    private parseStructuredBatchRejection(error: HttpStatusError): StructuredBatchRejection | null {
        if (error.responseBody == null || typeof error.responseBody !== 'object') return null;
        const body = error.responseBody as { rejectionScope?: unknown; rejectedOpIds?: unknown };

        if (body.rejectionScope === 'batch') return { scope: 'batch' };
        if (Array.isArray(body.rejectedOpIds)) {
            const rejectedOpIds = new Set(body.rejectedOpIds.filter((value): value is string => typeof value === 'string'));
            if (rejectedOpIds.size > 0) return { scope: 'items', rejectedOpIds };
        }
        return null;
    }

    private bodyForUnits(units: UnsyncedFlushUnit[]): string {
        const byKind = (kind: UnsyncedFlushUnit['kind']) => units.filter((unit) => unit.kind === kind);
        const adds = byKind('add');
        const updates = byKind('update');
        const removes = byKind('remove');
        return JSON.stringify({
            adds: adds.map((unit) => unit.payload),
            updates: updates.map((unit) => unit.payload),
            removes: removes.map((unit) => unit.payload),
            meta: {
                opIds: {
                    adds: adds.map((unit) => unit.opId ?? ''),
                    updates: updates.map((unit) => unit.opId ?? ''),
                    removes: removes.map((unit) => unit.opId ?? ''),
                },
            },
        });
    }

    private async applyStructuredBatchRejection(
        collectionName: string,
        url: string,
        units: UnsyncedFlushUnit[],
        rejection: StructuredBatchRejection,
        error: HttpStatusError
    ): Promise<{ flushed: number; failed: number; deadLettered: number }> {
        const rejected = rejection.scope === 'batch'
            ? units
            : units.filter((unit) => unit.opId != null && rejection.rejectedOpIds.has(unit.opId));
        const remaining = units.filter((unit) => !rejected.includes(unit));

        if (isConflictStatus(error.status) && rejected.length > 0) {
            this.notifyConflict(collectionName, rejected.map((unit) => unit.entity), error);
        }

        try {
            const deadChanges = await this.unsyncedQueue.deadLetter(rejected.flatMap((unit) => unit.rows));
            this.notifyDeadLetter(deadChanges, error);
        } catch (writeError) {
            logger.error('[HttpSwrDbPlugin] could not record structured batch rejection; changes stay queued', {
                collectionName,
                error: writeError,
            });
            return { flushed: 0, failed: units.length, deadLettered: 0 };
        }

        if (remaining.length === 0) {
            return { flushed: 0, failed: 0, deadLettered: rejected.length };
        }

        try {
            await this.postWithRetry(url, this.bodyForUnits(remaining), collectionName);
            await this.unsyncedQueue.removeRows(remaining.flatMap((unit) => unit.rows));
            return { flushed: remaining.length, failed: 0, deadLettered: rejected.length };
        } catch (retryError) {
            await this.unsyncedQueue.recordFailedAttempt(remaining.flatMap((unit) => unit.rows)).catch((writeError): void =>
                logger.warn('[HttpSwrDbPlugin] could not record remaining batch failure', { collectionName, error: writeError }));
            logger.warn('[HttpSwrDbPlugin] remaining batch failed after structured rejection; left queued', {
                collectionName,
                error: retryError,
            });
            return { flushed: 0, failed: remaining.length, deadLettered: rejected.length };
        }
    }

    /**
     * A batch was permanently rejected: replay each per-entity unit alone (single attempt)
     * so one poison item cannot block every other change in its collection forever.
     */
    private async isolatePoisonUnits(
        collectionName: string,
        url: string,
        units: UnsyncedFlushUnit[]
    ): Promise<{ flushed: number; failed: number; deadLettered: number }> {
        const outcome = { flushed: 0, failed: 0, deadLettered: 0 };

        for (const unit of units) {
            const body = this.bodyForUnits([unit]);

            try {
                const responseBody = await this.httpPlugin.postJson(url, body, collectionName);
                await this.unsyncedQueue.removeRows(unit.rows);
                outcome.flushed++;

                await this.reconcileFlushResponse(collectionName, responseBody).catch((err) =>
                    logger.warn('[HttpSwrDbPlugin] isolated flush echo reconciliation failed', { collectionName, error: err })
                );
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));

                if (err instanceof HttpStatusError && isPermanentStatus(err.status)) {
                    if (isConflictStatus(err.status)) {
                        this.notifyConflict(collectionName, [unit.entity], error);
                    }

                    // A dead-letter that cannot be written down is not a dead letter: the row is
                    // still pending and will be retried, so say so rather than reporting a
                    // give-up that did not happen.
                    let deadChanges: DeadLetteredChange[];
                    try {
                        deadChanges = await this.unsyncedQueue.deadLetter(unit.rows);
                    } catch (writeError) {
                        logger.error('[HttpSwrDbPlugin] could not record a dead letter; the change stays queued', {
                            collectionName,
                            status: err.status,
                            error: writeError,
                        });
                        outcome.failed++;
                        continue;
                    }

                    outcome.deadLettered++;
                    this.notifyDeadLetter(deadChanges, error);
                    logger.warn('[HttpSwrDbPlugin] change permanently rejected by the server; dead-lettered', {
                        collectionName,
                        status: err.status,
                    });
                    continue;
                }

                // Transient during isolation — leave it queued
                await this.unsyncedQueue.recordFailedAttempt(unit.rows).catch((writeError): void =>
                    logger.warn('[HttpSwrDbPlugin] could not record a failed attempt', { collectionName, error: writeError }));
                outcome.failed++;
            }
        }

        return outcome;
    }

    private notifyDeadLetter(changes: DeadLetteredChange[], error: Error): void {
        if (changes.length === 0) return;
        try {
            this.onSyncDeadLetter?.(changes, error);
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] onSyncDeadLetter threw', { error: err });
        }
    }

    private notifyConflict(collectionName: string, entities: unknown[], error: Error): void {
        try {
            this.onConflict?.({ collectionName, entities, error });
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] onConflict threw', { error: err });
        }
    }

    /** Records the schemas an event carried, so the flush can resolve one later. */
    private rememberSchemas(schemas: SchemaCollection): void {
        this.lastSeenSchemas = schemas;

        for (const [, schema] of schemas) {
            this.schemasByCollection.set(schema.collectionName, schema as CompiledSchema<UnknownRecord>);
        }
    }

    /**
     * Reconciles the echo from a background flush, the same way the direct POST path does.
     *
     * Called after the rows are dequeued, matching the direct path: while a change is still
     * queued its entity is shielded from being overwritten, so reconciling first would be a
     * no-op for exactly the rows the response is about.
     */
    private async reconcileFlushResponse(collectionName: string, responseBody: unknown): Promise<void> {
        if (this.translatePersistResponse == null || responseBody == null) {
            return;
        }

        const schema = this.schemasByCollection.get(collectionName);
        const schemas = this.lastSeenSchemas;

        if (schema == null || schemas == null) {
            // Nothing has read or written this collection through this plugin, so there is no
            // schema to translate with — and nothing could have been queued for it either.
            logger.debug('[HttpSwrDbPlugin] no schema known for flushed collection; echo not reconciled', { collectionName });
            return;
        }

        await this.reconcilePersistResponse(schema, schemas, responseBody);
    }

    /**
     * The same query with `skip` and `take` removed — the CANDIDATE SET the window selects from.
     *
     * A predicate survives being applied twice; a window does not. `filter` and `sort` can be
     * pushed to the server and re-applied locally over the rows that come back, and the answer
     * is the same. `skip(3)` cannot: the server applies it to the collection, the store then
     * holds only that page, and applying it again to three rows yields nothing (defect #48).
     *
     * So the window stays local. Everything that has to describe "the set the server and the
     * store should agree on" — the fetch, the revalidate comparison, and the cache key — uses
     * this; only the caller's own read keeps the window, and applies it exactly once.
     *
     * The cost is that the plugin syncs the whole filtered set rather than a page of it. That
     * is what a local-first cache is: it answers from rows it holds. Use `HttpDbPlugin`
     * directly when you want the server to paginate and no local copy.
     */
    private windowlessOperation<TRoot extends {}, TShape>(operation: IQuery<TRoot, TShape>): IQuery<TRoot, TShape> {
        const ordered: { name: QueryOptionName; value: unknown; index: number }[] = [];

        for (const [name, items] of operation.options.items) {
            if (name === 'skip' || name === 'take') {
                continue;
            }

            for (const item of items) {
                ordered.push({ name, value: (item.option as { value: unknown }).value, index: item.index });
            }
        }

        if (ordered.length === operation.options.items.size && this.hasNoWindow(operation)) {
            // Nothing to strip — hand back the original so the common case allocates nothing.
            return operation;
        }

        // Re-added in the original order: options are index-ordered and the execution-target
        // decision in `add` depends on what it has already seen.
        ordered.sort((left, right) => left.index - right.index);

        const options = QueryOptionsCollection.EMPTY<TShape>();

        for (const { name, value } of ordered) {
            options.add(name as never, value as never);
        }

        return new Query<TRoot, TShape>(options, operation.schema, operation.changeTracking);
    }

    private hasNoWindow<TRoot extends {}, TShape>(operation: IQuery<TRoot, TShape>): boolean {
        return operation.options.items.has('skip') === false && operation.options.items.has('take') === false;
    }

    /**
     * Keyed on the candidate set, not the window.
     *
     * Freshness is a property of "what the server holds for this filter", and every page of a
     * list is the same answer sliced differently. Keying per window would make page two refetch
     * data page one had just brought down, and would let one page's revalidate compute its
     * removes against another page's rows (defect #49).
     */
    private getCacheKey<TRoot extends {}, TShape>(event: DbPluginQueryEvent<TRoot, TShape>): string {
        const queryParams = buildQueryParams(this.windowlessOperation(event.operation), { ignoreQueryForCollections: [] });
        return `${event.operation.schema.id}|${JSON.stringify(queryParams)}`;
    }

    /** The event used to talk to the server and to read the store for comparison. */
    private candidateSetEvent<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        reason: string,
        timing: 'blocking' | 'background'
    ): DbPluginQueryEvent<TRoot, TShape> {
        return {
            ...event,
            id: uuid(8),
            source: HttpSwrDbPlugin.name,
            action: 'query' as const,
            reason,
            operation: this.windowlessOperation(event.operation),
            // A background leg runs after the caller's explanation was delivered, so it must
            // not inherit `explain` or push into the caller's shared array.
            ...(timing === 'background' ? { explain: false, executedQueries: [] } : {}),
        };
    }

    private isStale(cacheKey: string): boolean {
        const meta = this.cacheMetadata.get(cacheKey);
        if (!meta) {
            return true;
        }
        // Inclusive so maxAgeMs=0 means "always stale" even within the same millisecond
        return Date.now() - meta.lastRevalidatedAt >= this.maxAgeMs;
    }

    private setRevalidated(cacheKey: string): void {
        this.cacheMetadata.set(cacheKey, { lastRevalidatedAt: Date.now() });
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

        // Local unsynced changes are authoritative until the remote confirms them:
        //  - a pending local remove must not be resurrected as an add
        //  - a pending local add/update must not be clobbered by the stale server copy
        const isUnsynced = (entity: unknown) => unsyncedKeys.has(entityIdKey(schema, entity));

        const adds = incomingRows.filter((r) => !existingById.has(schema.hash(r as never, HashType.Ids)) && !isUnsynced(r));
        const updates = incomingRows
            .filter((r) => {
                if (isUnsynced(r)) {
                    return false;
                }
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

            return !isUnsynced(e);
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

        // Disposed in a `finally`, and that is not tidiness. Creating a SchemaSubscription
        // retains the schema's shared BroadcastChannel, so one that is never disposed
        // raises the refcount permanently and the channel can never close — two MessagePort
        // handles held for the life of the process, per revalidation. This one exists only
        // to carry a single send.
        // Scoped to THIS database, because that is where the listeners are: a datastore
        // subscribes on `schema|databaseName`, so a send with no scope lands on a channel
        // nobody is listening to and the revalidation is silently never delivered.
        const subscription = schema.createSubscription(undefined, this.databaseName);

        try {
            subscription.send({
                adds: classification.adds,
                updates: classification.updates.map((u) => u.entity),
                removals: classification.removes,
                unknown: [],
            } as SubscriptionChanges<Record<string, unknown>>);
        } finally {
            subscription[Symbol.dispose]();
        }
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
            // Background: runs after the caller's explanation was delivered.
            explain: false,
            executedQueries: [],
            // Windowless, so `existing` and `incoming` describe the same set. Comparing a
            // page of the store against the whole server response would classify every row
            // outside the page as an add, and every row outside the response as a remove.
            operation: this.windowlessOperation(event.operation),
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

        // Locked so the classification cannot interleave with a user write it did not see
        await this.storeMutex.run(collectionName, async () => {
            const unsyncedKeys = await this.unsyncedQueue.getUnsyncedIdKeys(collectionName);
            const classification = this.classifyRevalidateChanges(schema, incomingRows, [], unsyncedKeys);
            await this.applyRevalidatePersist(event, schema, classification);
        });
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

        // Locked around the whole read-classify-persist so a user write can never land
        // between the store read and the diff that claims to describe it
        return this.storeMutex.run(collectionName, () => new Promise((resolve, reject) => {
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
        }));
    }

    private queryResultToArray<T>(translatedValue: ITranslatedValue<T>) {
        const result: unknown[] = [];
        translatedValue.forEach(item => {
            result.push(item)
        });
        return result;
    }

    private startRevalidate<TRoot extends {}, TShape>(
        cacheKey: string,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        logger.debug('[HttpSwrDbPlugin] revalidate requested', { collectionName, cacheKey });

        // A revalidate already running for this query is the answer for this one too. Deduped
        // here as well as in the transport because this covers the store write, not just the GET.
        void this.missPacer
            .share(`revalidate:${cacheKey}`, () => this.runRevalidate(cacheKey, event, cachedTranslated))
            .catch((err: unknown) => logger.warn('[HttpSwrDbPlugin] revalidate failed', { collectionName, error: err }));
    }

    private runRevalidate<TRoot extends {}, TShape>(
        cacheKey: string,
        event: DbPluginQueryEvent<TRoot, TShape>,
        cachedTranslated: ITranslatedValue<TShape>
    ): Promise<void> {
        const collectionName = event.operation.schema.collectionName;
        // The candidate set, not the page: see windowlessOperation.
        const remoteEvent = this.candidateSetEvent(event, 'revalidate', 'background');
        return new Promise((resolve) => {
            this.httpPlugin.query(remoteEvent, (result) => {
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
        this.rememberSchemas(event.schemas);

        const cacheKey = this.getCacheKey(event);
        this.swrStore.query(event, (swrResponse) => {
            const collectionName = event.operation.schema.collectionName;
            if (swrResponse.ok === Result.ERROR) {
                logger.warn('[HttpSwrDbPlugin] swrStore query failed', { collectionName, error: swrResponse.error });
                done(swrResponse);
                return;
            }

            const hasData = !swrResponse.data.isEmpty;

            // An empty result is not the same thing as a cold cache. A filter that legitimately
            // matches nothing — "show me overdue items", with none overdue — used to be read as
            // "nothing cached yet" and sent to the network on EVERY read, ignoring maxAgeMs
            // entirely: three reads of an empty view cost four requests. Freshness decides, and
            // only a query never successfully fetched goes to the network.
            if (!hasData && this.isStale(cacheKey)) {
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
        cacheKey: string,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        logger.debug('[HttpSwrDbPlugin] cache miss, fetching from source', { collectionName });

        // One GET for however many callers are waiting on this query. They are answered from the
        // store rather than handed the fetched result object: an ITranslatedValue is consumed by
        // reading it, so sharing one across callers gave the first the rows and the rest nothing.
        void this.missPacer.share(`miss:${cacheKey}`, () => this.fetchOnCacheMiss(event, cacheKey)).then(
            (outcome) => {
                if (outcome === 'store-failed') {
                    done(PluginEventResult.error(event.id, new Error(`Could not store fetched ${collectionName}`)));
                    return;
                }

                if (outcome === 'remote-failed') {
                    // Auth errors are already notified by HttpDbPlugin.query
                    logger.warn('[HttpSwrDbPlugin] query remote failed, falling back to SWR store', { collectionName });
                }

                this.swrStore.query(event, done);
            },
            (err) => {
                logger.warn('[HttpSwrDbPlugin] cache-miss fetch rejected', { collectionName, error: err });
                this.swrStore.query(event, done);
            }
        );
    }

    /**
     * Fetches a cold collection and stores it. Shared between concurrent callers, so it reports
     * only what happened — each caller then reads its own answer out of the store, with its own
     * filter applied.
     */
    private async fetchOnCacheMiss<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        cacheKey: string
    ): Promise<'stored' | 'remote-failed' | 'store-failed'> {
        const collectionName = event.operation.schema.collectionName;
        // The candidate set, not the page: see windowlessOperation.
        const remoteEvent = this.candidateSetEvent(event, 'cache-miss', 'blocking');
        const result = await new Promise<PluginEventResultType<ITranslatedValue<TShape>>>((resolve) => {
            this.httpPlugin.query(remoteEvent, resolve);
        });

        if (result.ok !== Result.SUCCESS) {
            return 'remote-failed';
        }

        try {
            await this.persistOnCacheMiss(event, result.data);
            this.setRevalidated(cacheKey);
            return 'stored';
        } catch (err) {
            this.onRevalidateError?.(err instanceof Error ? err : new Error(String(err)), { collectionName });
            return 'store-failed';
        }
    }

    /**
     * Acquires the store mutex for every collection name (sorted, so two callers can
     * never deadlock on lock order), then runs the work. NOT re-entrant — never call
     * from code already holding one of these locks.
     */
    private runLockedOnCollections<T>(collectionNames: string[], work: () => Promise<T>): Promise<T> {
        const sorted = [...new Set(collectionNames)].sort();

        const runAt = (index: number): Promise<T> =>
            index >= sorted.length ? work() : this.storeMutex.run(sorted[index], () => runAt(index + 1));

        return runAt(0);
    }

    private persistToSwrStore(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        const collectionNames: string[] = [];
        for (const [schemaId, changes] of event.operation) {
            if (!changes.hasItems) continue;
            const schema = event.schemas.get(schemaId);
            if (schema != null) collectionNames.push(schema.collectionName);
        }

        return this.runLockedOnCollections(collectionNames, () => new Promise((resolve, reject) => {
            const swrEvent: DbPluginBulkPersistEvent = {
                ...event,
                id: uuid(8),
                source: HttpSwrDbPlugin.name,
                action: 'persist' as const,
                reason: 'optimistic',
            };
            logger.debug('[HttpSwrDbPlugin] persistToSwrStore', { swrEvent });
            this.swrStore.bulkPersist(swrEvent, (persistResult) => {
                if (persistResult.ok === Result.ERROR) {
                    reject(persistResult.error);
                    return;
                }
                resolve(persistResult.data);
            });
        }));
    }

    /**
     * POST with retries. Headers are fetched per attempt (fresh tokens), backoff is jittered
     * and honors Retry-After, permanent 4xx failures stop immediately (the caller classifies
     * them), and a successful re-auth after 401/403 earns exactly one extra attempt.
     * Returns the parsed response body (or null) so callers can reconcile server echoes.
     */
    private async postWithRetry(
        url: string,
        body: string,
        collectionName: string,
    ): Promise<unknown> {
        let lastError: Error | null = null;
        let reauthAttempted = false;

        // maxAttempts INCLUDES the initial attempt: maxAttempts=1 means one POST, no retries.
        // A successful re-auth raises the ceiling by one rather than spending a retry — the
        // re-auth retry is promised unconditionally, so it must survive maxAttempts=1.
        let attemptsAllowed = Math.max(1, this.bulkPersistRetryMaxAttempts);

        for (let attempt = 0; attempt < attemptsAllowed; attempt++) {
            // Headers are fetched inside postJson, per attempt, so a token refreshed mid-loop is
            // still picked up immediately
            let retryAfterMs: number | null = null;

            try {
                const responseBody = await this.httpPlugin.postJson(url, body, collectionName);

                if (attempt > 0) {
                    logger.info('[HttpSwrDbPlugin] bulkPersist succeeded on retry', {
                        collectionName,
                        attempt,
                    });
                }

                return responseBody;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));

                if (err instanceof HttpStatusError) {
                    if (isAuthStatus(err.status)) {
                        const reauthSucceeded = await this.httpPlugin.notifyAuthError(buildAuthErrorEvent(err, 'bulkPersist'));

                        if (reauthSucceeded && !reauthAttempted) {
                            reauthAttempted = true;
                            attemptsAllowed++;
                            logger.info('[HttpSwrDbPlugin] re-auth succeeded, retrying POST once', { collectionName });
                            continue;
                        }

                        break;
                    }

                    // Permanent rejection: retrying cannot succeed; the caller dead-letters
                    if (isPermanentStatus(err.status)) {
                        break;
                    }

                    retryAfterMs = err.retryAfterMs;
                }
            }

            const hasMoreAttempts = attempt < attemptsAllowed - 1;

            if (!hasMoreAttempts) {
                break;
            }

            const delayMs = backoffDelayMs(attempt, this.bulkPersistRetryBaseDelayMs, this.bulkPersistRetryMaxDelayMs, retryAfterMs);
            logger.warn('[HttpSwrDbPlugin] bulkPersist failed, retrying', {
                collectionName,
                attempt: attempt + 1,
                maxAttempts: attemptsAllowed,
                delayMs,
                error: lastError,
            });
            await new Promise((r) => setTimeout(r, delayMs));
        }

        throw lastError ?? new Error('bulkPersist failed');
    }

    protected formatRequestBody(
        changes: SchemaPersistChanges<Record<string, unknown>>,
        schema: CompiledSchema<UnknownRecord>,
        queuedChanges: QueuedChange[] = []
    ) {
        const { adds, updates, removes } = changes;
        // Additive idempotency metadata: opIds parallel to adds/updates/removes so a server
        // that opts in can dedupe replays; servers that don't can ignore `meta` entirely.
        const opIdsOf = (kind: QueuedChange['kind']) => queuedChanges.filter((c) => c.kind === kind).map((c) => c.opId ?? '');
        const schemaRecord = schema as CompiledSchema<Record<string, unknown>>;

        // An update sends the key fields plus the fields that changed — enough to identify the
        // row and nothing more. Adds and removes send whole entities: an add has no prior state
        // to patch, and a remove is addressed by key anyway.
        return JSON.stringify({
            adds,
            updates: updates.map((u) => buildUpdatePayload(schemaRecord, u.entity, u.delta) ?? u.entity),
            removes,
            meta: { opIds: { adds: opIdsOf('add'), updates: opIdsOf('update'), removes: opIdsOf('remove') } },
        });
    }

    /**
     * Build one task per schema that has changes. Every change is queued as unsynced
     * (with its kind, removes included) and the queue write is AWAITED before the ack,
     * so by the time the caller sees success the sync obligation is durable — a POST
     * failure or a crash can always be replayed by the background flush.
     */
    private async buildBulkPersistTasks(
        event: DbPluginBulkPersistEvent
    ): Promise<BulkPersistTask[]> {
        const tasks: BulkPersistTask[] = [];
        for (const [schemaId, changes] of event.operation) {
            if (!changes.hasItems) continue;

            const schema = event.schemas.get<UnknownRecord>(schemaId);
            assertIsNotNull(schema);

            const { adds, updates, removes } = changes;
            const collectionName = schema.collectionName;
            const schemaRecord = schema as CompiledSchema<Record<string, unknown>>;
            const queuedChanges: QueuedChange[] = [
                ...adds.map((entity) => ({ kind: 'add' as const, entity: entity as unknown })),
                // The trimmed body rides along, so a replay sends exactly what the direct POST
                // would have — the delta is gone by the time the flush runs
                ...updates.map((u) => ({
                    kind: 'update' as const,
                    entity: u.entity as unknown,
                    payload: buildUpdatePayload(schemaRecord, u.entity, u.delta),
                })),
                ...removes.map((entity) => ({ kind: 'remove' as const, entity: entity as unknown })),
            ];
            // Awaited: stamps opId/revision on each change AND makes the obligation durable
            await this.unsyncedQueue.addMany(schema, queuedChanges);

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
                body: this.formatRequestBody(changes, schema, queuedChanges),
                collectionName,
                schemaId,
                schema,
                changes,
                queuedChanges,
            });
        }
        return tasks;
    }

    private async bulkPersistAsync(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): Promise<void> {
        this.rememberSchemas(event.schemas);

        const result = event.operation.toResult();

        logger.debug('[HttpSwrDbPlugin] bulkPersistAsync() -> start', { eventId: event.id });

        // Phase 1 — local: persist to the SWR store and ack the caller. Any failure
        // HERE is a real persist failure and surfaces through done().
        let localPersistResult: BulkPersistResult;
        try {
            localPersistResult = await this.persistToSwrStore(event);
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] bulkPersist failed against the SWR store', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            return;
        }

        for (const [schemaId, changes] of localPersistResult) {
            const { adds, removes, updates, hasItems } = changes;

            if (hasItems === false) {
                continue;
            }

            const schemaResult = result.get(schemaId);

            schemaResult.adds.push(...adds);
            schemaResult.removes.push(...removes);
            schemaResult.updates.push(...updates);
        }

        // Queue every change as unsynced BEFORE acking, so the sync obligation is
        // durable by the time the caller sees success. A queue-write failure fails the
        // persist: success without a recorded obligation would be a lie.
        let postTasks: BulkPersistTask[];
        try {
            postTasks = await this.buildBulkPersistTasks(event);
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] failed to record sync obligation; failing persist', { eventId: event.id, error: err });
            done(PluginEventResult.error(event.id, err instanceof Error ? err : new Error(String(err))));
            return;
        }

        // Single ack: local persist succeeded. HTTP failures after this point are
        // handled by the retry queue and MUST NOT call done() again.
        done(PluginEventResult.success(event.id, result));

        // Everything after the ack must never reach done() again — failures here are
        // recovered by the unsynced queue, not reported to the caller.
        try {
            // We are subscribed to the SWR Store, not to the SWR Plugin, so send the
            // notification ourselves — with the RESOLVED entities (store-assigned ids),
            // not the raw operation payload.
            for (const [schemaId, changes] of localPersistResult) {
                if (changes.hasItems === false) {
                    continue;
                }

                const schema = event.schemas.get<UnknownRecord>(schemaId);
                this.notifySchemaSubscription(schema, {
                    adds: changes.adds,
                    removes: changes.removes,
                    updates: changes.updates.map((entity) => ({ entity: entity as unknown, changeType: 'markedDirty' as const, delta: {} }))
                });
            }

            // Phase 2 — remote. Everything is already durable in the queue, so this is only
            // about *when* it goes out.
            if (this.postOnPersist === false) {
                // Delivery belongs to the paced flush. Deliberately NOT requesting one here:
                // flushing per save is what this mode exists to avoid, and it would put the
                // request count straight back where it was. The auto-sync loop picks the change
                // up on its next tick — or `syncNow()` does, under `autoSync: false`.
                logger.debug('[HttpSwrDbPlugin] queued for the paced flush; no POST on this save', {
                    eventId: event.id,
                });
                return;
            }

            // POST each schema's changes; successes are dequeued (compare-and-delete, so a newer
            // local edit mid-POST stays queued) and their server echoes reconciled; failures stay
            // queued for the background flush, which also owns dead-lettering.
            //
            // Serialized per collection by the pacer: two saves to one collection in the same
            // tick used to open two connections at once, and a burst scaled with the burst.
            const postResults = await Promise.allSettled(
                postTasks.map((t) =>
                    this.postWithRetry(t.url, t.body, t.collectionName)
                )
            );

            for (let i = 0; i < postResults.length; i++) {
                const outcome = postResults[i];
                const t = postTasks[i];

                if (outcome.status === 'fulfilled') {
                    await this.unsyncedQueue.removeMany(t.schema, t.queuedChanges).catch((err) =>
                        logger.warn('[HttpSwrDbPlugin] failed to dequeue confirmed changes', { collectionName: t.collectionName, error: err }));
                    await this.reconcilePersistResponse(t.schema, event.schemas, outcome.value).catch((err) =>
                        logger.warn('[HttpSwrDbPlugin] failed to reconcile persist response', { collectionName: t.collectionName, error: err }));
                    continue;
                }

                const reason = outcome.reason;

                if (reason instanceof HttpStatusError && isConflictStatus(reason.status)) {
                    // Informational now; the background flush isolates and dead-letters it
                    this.notifyConflict(t.collectionName, t.queuedChanges.map((c) => c.entity), reason);
                }

                logger.warn('[HttpSwrDbPlugin] bulkPersist POST failed; changes remain queued for background sync', {
                    eventId: event.id,
                    collectionName: t.collectionName,
                    error: String(reason),
                });
            }
        } catch (err) {
            logger.error('[HttpSwrDbPlugin] bulkPersist post-ack work failed; changes remain queued for background sync', {
                eventId: event.id,
                error: err,
            });
        }
    }

    /** Reads the full collection from the SWR store (used to classify server echoes). */
    private queryStoreAll(schema: CompiledSchema<UnknownRecord>, schemas: SchemaCollection): Promise<unknown[]> {
        return new Promise((resolve, reject) => {
            const storeEvent: DbPluginQueryEvent<UnknownRecord, UnknownRecord> = {
                id: uuid(8),
                schemas,
                source: HttpSwrDbPlugin.name,
                action: 'query',
                explain: false,
                executedQueries: [],
                reason: 'persist-echo',
                operation: Query.EMPTY<UnknownRecord, UnknownRecord>(schema),
            };
            this.swrStore.query(storeEvent, (queryResult) => {
                if (queryResult.ok === Result.ERROR) {
                    reject(queryResult.error);
                    return;
                }
                resolve(this.queryResultToArray(queryResult.data));
            });
        });
    }

    /**
     * Reconciles the server's POST response into the SWR store: the echoed entities are
     * the canonical copies (server-assigned ids, timestamps, versions), so they upsert
     * over the optimistic local ones. Never removes. No-op unless translatePersistResponse
     * is configured and returns entities.
     */
    private async reconcilePersistResponse(
        schema: CompiledSchema<UnknownRecord>,
        schemas: SchemaCollection,
        responseBody: unknown
    ): Promise<void> {
        if (this.translatePersistResponse == null || responseBody == null) {
            return;
        }

        let entities: unknown[] | null;
        try {
            entities = this.translatePersistResponse(schema, responseBody);
        } catch (err) {
            logger.warn('[HttpSwrDbPlugin] translatePersistResponse threw', { collectionName: schema.collectionName, error: err });
            return;
        }

        if (entities == null || entities.length === 0) {
            return;
        }

        const echoed = entities;

        await this.storeMutex.run(schema.collectionName, async () => {
            const current = await this.queryStoreAll(schema, schemas);
            const schemaRecord = schema as CompiledSchema<Record<string, unknown>>;
            const existingIds = new Set(current.map((e) => schemaRecord.hash(e as never, HashType.Ids)));

            const classification: RevalidateClassification = {
                adds: echoed.filter((e) => !existingIds.has(schemaRecord.hash(e as never, HashType.Ids))),
                updates: echoed
                    .filter((e) => existingIds.has(schemaRecord.hash(e as never, HashType.Ids)))
                    .map((entity) => ({ entity, changeType: 'markedDirty' as const, delta: {} as Record<string, unknown> })),
                removes: [],
            };

            const bulkChanges = new BulkPersistChanges();
            const schemaChanges = bulkChanges.resolve(schema.id);
            schemaChanges.adds = classification.adds as never[];
            schemaChanges.updates = classification.updates as never[];

            await new Promise<void>((resolve, reject) => {
                this.swrStore.bulkPersist({
                    id: uuid(8),
                    schemas,
                    operation: bulkChanges,
                    source: HttpSwrDbPlugin.name,
                    action: 'persist',
                    reason: 'persist-echo',
                }, (persistResult) => {
                    if (persistResult.ok === Result.ERROR) {
                        reject(persistResult.error);
                        return;
                    }
                    this.notifySchemaSubscription(schemaRecord, classification);
                    resolve();
                });
            });
        });
    }
}
