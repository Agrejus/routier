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
import type { CompiledSchema, SubscriptionChanges } from '@routier/core/schema';
import { HashType } from '@routier/core/schema';
import {
    PluginEventCallbackResult,
    PluginEventCallbackPartialResult,
    PluginEventResult,
    Result,
} from '@routier/core/results';
import { BulkPersistResult, BulkPersistChanges, SchemaCollection, SchemaPersistChanges } from '@routier/core/collections';
import { logger, UnknownRecord, uuid } from '@routier/core/utilities';
import { DEFAULT_WRITE_BATCH_DELAY_MS, HttpDbPlugin, type HttpConnectionOptions } from './HttpDbPlugin';
import type { ConditionalQueryResult } from './httpQueryRunner';
import { assertIsNotNull } from '@routier/core';

import { UnsyncedQueue, type QueuedChange, type UnsyncedFlushUnit, type UnsyncedQueueRow } from './UnsyncedQueue';
import { buildUpdatePayload, entityIdKey, etagOrder } from './swrUtils';
import { ConditionalRevalidation } from './conditionalRevalidation';
import { SWR_DEFAULTS } from './constants';
import { buildQueryParams } from './queryParamHelpers';
import { HttpStatusError, KeyedMutex, RequestPacer } from './httpUtils';
import { addOutcomes, bodyForUnits, NOTHING_DELIVERED, QueuedWriteSender, type DeliveryOutcome } from './queuedWrites';
import { runWithOnError, statusOf, type ActionKit, type Settlement } from './requestFailures';
import { emitEvent, type SwrRequestError, type SyncEvent, type SyncHooks } from './syncHooks';

/** What a sync moved. Returned by `syncNow()` and reported as the `synced` event. */
export type SyncOutcome = DeliveryOutcome;

/**
 * When the plugin syncs on its own.
 *
 * Automatic is the default and needs no configuration: unsynced changes retry on a backing-off
 * timer, and immediately when the browser regains connectivity. Every field here is an override
 * for an app that wants a different cadence — or none at all, driving `syncNow()` itself.
 */
export interface AutoSyncOptions {
    delayMs?: number;
    /** Ceiling for the backing-off delay. Default 60_000. */
    maxDelayMs?: number;
    /**
     * Flush the moment the platform reports connectivity is back, instead of waiting out the
     * current delay. Default true; ignored where there is no `online` event to listen for.
     */
    syncWhenOnline?: boolean;
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
export interface HttpSwrDbPluginOptions extends HttpConnectionOptions, SyncHooks<SwrRequestError> {
    /**
     * Background sync policy. Omit for the automatic default (retry on a backing-off timer plus
     * an immediate flush when connectivity returns), pass an object to tune it, or pass `false`
     * to turn it off entirely and drive `syncNow()` yourself.
     *
     * Turning it off does not turn off *queueing* — changes are still recorded durably before
     * every ack. It only means nothing replays them until you ask.
     */
    autoSync?: boolean | AutoSyncOptions;
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
    conditionalRevalidation?: boolean;
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

function resolveAutoSync(options: HttpSwrDbPluginOptions): Required<AutoSyncOptions> | null {
    if (!options.autoSync) {
        return null;
    }

    const overrides = options.autoSync === true ? {} : options.autoSync;

    return {
        delayMs: overrides.delayMs ?? SWR_DEFAULTS.autoSyncDelayMs,
        maxDelayMs: overrides.maxDelayMs ?? SWR_DEFAULTS.autoSyncMaxDelayMs,
        syncWhenOnline: overrides.syncWhenOnline ?? true,
        minIntervalMs: overrides.minIntervalMs ?? DEFAULT_MIN_FLUSH_INTERVAL_MS,
    };
}

const DEFAULT_MIN_FLUSH_INTERVAL_MS = 250;

const deltaOf = (payload: unknown): Record<string, unknown> => Object.fromEntries(Object.entries(Object.assign({}, payload)));

/** Result of comparing incoming rows with store + unsynced set during revalidate. */
interface RevalidateClassification {
    adds: unknown[];
    updates: { entity: unknown; changeType: 'markedDirty'; delta: Record<string, unknown> }[];
    removes: unknown[];
}

/** Single-schema task for bulk persist: POST payload + data needed to finalize on success. */


export class HttpSwrDbPlugin implements IDbPlugin {
    private readonly httpPlugin: HttpDbPlugin;
    private readonly swrStore: IDbPlugin;
    private readonly maxAgeMs: number;
    private readonly conditional: ConditionalRevalidation | null;
    private readonly translatePersistResponse?: (schema: CompiledSchema<UnknownRecord>, responseBody: unknown) => unknown[] | null;
    private readonly unsyncedQueue: UnsyncedQueue;
    private readonly sender: QueuedWriteSender;
    private readonly onEvent?: (event: SyncEvent) => void;
    private readonly onError?: (error: SwrRequestError) => void;
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
    private readonly writeBatchDelayMs: number;
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
        this.httpPlugin = new HttpDbPlugin({ ...options, onEvent: undefined, onError: undefined });
        this.swrStore = swrStore;
        this.maxAgeMs = options?.maxAgeMs ?? SWR_DEFAULTS.maxAgeMs;
        this.conditional = options.conditionalRevalidation === false ? null : new ConditionalRevalidation(options.unsyncedQueueStore);
        this.translatePersistResponse = options?.translatePersistResponse;
        this.unsyncedQueue = new UnsyncedQueue(options.unsyncedQueueStore);
        this.onEvent = options.onEvent;
        this.onError = options.onError;
        this.sender = new QueuedWriteSender({
            queue: this.unsyncedQueue,
            post: (url, body, collectionName) => this.httpPlugin.postJson(url, body, collectionName),
            formatBody: (collectionName, units) => this.formatUnits(collectionName, units),
            onError: options.onError,
            onEvent: options.onEvent,
            afterSent: (collectionName, responseBody) => this.reconcileFlushResponse(collectionName, responseBody),
            afterRejected: (collectionName) => this.forgetFreshness(collectionName),
        });
        this.postOnPersist = options?.postOnPersist ?? true;
        this.writeBatchDelayMs = options.writeBatchDelayMs ?? DEFAULT_WRITE_BATCH_DELAY_MS;
        this.autoSync = resolveAutoSync(options);

        if (this.autoSync != null) {
            this.startBackgroundSync();

            if (this.autoSync.syncWhenOnline && typeof globalThis.addEventListener === 'function') {
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
            return { revived, outcome: NOTHING_DELIVERED };
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
                        run(outcome.sent > 0 && outcome.failed === 0 ? 0 : attempt + 1);
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
                return NOTHING_DELIVERED;
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

    private flushSoon(): void {
        setTimeout(() => {
            void this.requestFlush().catch((error) =>
                logger.warn('[HttpSwrDbPlugin] could not send the saved changes; they stay queued', { error }));
        }, this.writeBatchDelayMs);
    }

    private async flushUnsynced(): Promise<SyncOutcome> {
        let outcome = NOTHING_DELIVERED;

        for (const collectionName of await this.unsyncedQueue.getUnsyncedCollections()) {
            const payload = await this.unsyncedQueue.getUnsyncedEntitiesForFlush(collectionName);
            outcome = addOutcomes(outcome, await this.sender.send(collectionName, this.httpPlugin.collectionUrl(collectionName), payload.units));
        }

        if (outcome.sent + outcome.failed + outcome.rejected > 0) {
            emitEvent(this.onEvent, { type: 'synced', ...outcome });
        }

        return outcome;
    }

    private formatUnits(collectionName: string, units: UnsyncedFlushUnit[]): string {
        const schema = this.schemasByCollection.get(collectionName);

        if (schema == null) {
            return bodyForUnits(units);
        }

        const changes = new SchemaPersistChanges<Record<string, unknown>>();
        const queued: QueuedChange[] = units.map((unit) => ({ kind: unit.kind, entity: unit.entity, opId: unit.opId ?? undefined }));

        for (const unit of units) {
            if (unit.kind === 'add') {
                changes.adds.push(unit.entity as never);
            } else if (unit.kind === 'update') {
                changes.updates.push({ entity: unit.entity as never, changeType: 'markedDirty', delta: deltaOf(unit.payload) as never });
            } else {
                changes.removes.push(unit.entity as never);
            }
        }

        return this.formatRequestBody(changes, schema, queued);
    }







    private forgetFreshness(collectionName: string): void {
        const schema = this.schemasByCollection.get(collectionName);

        if (schema == null) {
            return;
        }

        const prefix = `${schema.id}|`;

        for (const cacheKey of Array.from(this.cacheMetadata.keys())) {
            if (cacheKey.startsWith(prefix)) {
                this.cacheMetadata.delete(cacheKey);
            }
        }

        void this.conditional?.forget(prefix);
    }


    /** Records the schemas an event carried, so the flush can resolve one later. */
    private rememberSchemas(schemas: SchemaCollection): void {
        this.lastSeenSchemas = schemas;

        for (const [, schema] of schemas) {
            this.schemasByCollection.set(schema.collectionName, schema as CompiledSchema<UnknownRecord>);
        }
    }

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
        unsyncedKeys: Set<string>,
        rejectedKeys: Set<string>
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
                const existing = existingById.get(schema.hash(r as never, HashType.Ids));

                if (existing == null) {
                    return false;
                }

                const order = rejectedKeys.has(entityIdKey(schema, r)) ? null : etagOrder(schema, existing, r);
                return order == null ? !schema.compare(r as never, existing as never) : order < 0;
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
            etags: 'keep',
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
        const rejectedKeys = await this.unsyncedQueue.getDeadIdKeys(schema.collectionName);
        const classification = this.classifyRevalidateChanges(schema, incomingRows, currentRows, unsyncedKeys, rejectedKeys);

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
            const classification = this.classifyRevalidateChanges(schema, incomingRows, [], unsyncedKeys, new Set());
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
        event: DbPluginQueryEvent<TRoot, TShape>
    ): void {
        const collectionName = event.operation.schema.collectionName;
        logger.debug('[HttpSwrDbPlugin] revalidate requested', { collectionName, cacheKey });

        // A revalidate already running for this query is the answer for this one too. Deduped
        // here as well as in the transport because this covers the store write, not just the GET.
        void this.missPacer
            .share(`revalidate:${cacheKey}`, () => this.runRevalidate(cacheKey, event))
            .catch((err: unknown) => logger.warn('[HttpSwrDbPlugin] revalidate failed', { collectionName, error: err }));
    }

    private async runRevalidate<TRoot extends {}, TShape>(
        cacheKey: string,
        event: DbPluginQueryEvent<TRoot, TShape>
    ): Promise<void> {
        const collectionName = event.operation.schema.collectionName;
        const remoteEvent = this.candidateSetEvent(event, 'revalidate', 'background');
        const ifNoneMatch = await this.conditional?.ifNoneMatch(cacheKey, () => this.countStoreRows(remoteEvent)) ?? null;
        const settled = await this.readRemote(remoteEvent, ifNoneMatch);

        if (settled.outcome !== 'success') {
            this.reportRead(collectionName, settled.error);
            return;
        }

        const result = settled.value;

        if (result.kind === 'not-modified') {
            this.setRevalidated(cacheKey);
            emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: 304 });
            return;
        }

        try {
            await this.persistToStore(event, result.data);
        } catch (error) {
            this.reportRead(collectionName, error instanceof Error ? error : new Error(String(error)));
            return;
        }

        this.setRevalidated(cacheKey);
        await this.conditional?.remember(cacheKey, result.etag, () => this.countStoreRows(remoteEvent));
        emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: 200 });
    }

    private readRemote<TRoot extends {}, TShape>(
        remoteEvent: DbPluginQueryEvent<TRoot, TShape>,
        ifNoneMatch: string | null
    ): Promise<Settlement<Exclude<ConditionalQueryResult<TShape>, { kind: 'failed' }>>> {
        return runWithOnError({
            attempt: async () => {
                const result = await this.httpPlugin.queryConditional(remoteEvent, ifNoneMatch);

                if (result.kind === 'failed') {
                    throw result.error;
                }

                return result;
            },
            context: { operation: 'read', collectionName: remoteEvent.operation.schema.collectionName, method: 'GET', url: this.httpPlugin.queryUrl(remoteEvent), storeSource: false },
            onError: this.onError,
            actions: ({ retry, done, useCached }: ActionKit) => ({ retry, done, useCached }),
            unhandled: (kit: ActionKit) => kit.done(),
        });
    }

    private reportRead(collectionName: string, error: Error): void {
        emitEvent(this.onEvent, { type: 'read', ok: false, collectionName, status: statusOf(error), error });
    }

    private countStoreRows<TRoot extends {}, TShape>(remoteEvent: DbPluginQueryEvent<TRoot, TShape>): Promise<number | null> {
        return new Promise((resolve) => {
            this.swrStore.query({ ...remoteEvent, id: uuid(8) }, (result) => {
                resolve(result.ok === Result.SUCCESS ? this.queryResultToArray(result.data).length : null);
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
                setTimeout(() => this.startRevalidate(cacheKey, event), 0);
            } else {
                logger.info('[HttpSwrDbPlugin] cache not stale');
            }
        });
    }

    private onCacheMiss<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        cacheKey: string,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        void this.missPacer.share(`miss:${cacheKey}`, () => this.fetchOnCacheMiss(event, cacheKey)).then(
            (error) => {
                if (error != null) {
                    done(PluginEventResult.error(event.id, error));
                    return;
                }

                this.swrStore.query(event, done);
            },
            (error) => done(PluginEventResult.error(event.id, error instanceof Error ? error : new Error(String(error))))
        );
    }

    private async fetchOnCacheMiss<TRoot extends {}, TShape>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        cacheKey: string
    ): Promise<Error | null> {
        const collectionName = event.operation.schema.collectionName;
        const remoteEvent = this.candidateSetEvent(event, 'cache-miss', 'blocking');
        const settled = await this.readRemote(remoteEvent, null);

        if (settled.outcome !== 'success') {
            this.reportRead(collectionName, settled.error);
            return settled.outcome === 'cached' ? null : settled.error;
        }

        if (settled.value.kind !== 'modified') {
            const error = new HttpStatusError(304, 'Not Modified', null);
            this.reportRead(collectionName, error);
            return error;
        }

        try {
            await this.persistOnCacheMiss(event, settled.value.data);
            this.setRevalidated(cacheKey);
            await this.conditional?.remember(cacheKey, settled.value.etag, () => this.countStoreRows(remoteEvent));
        } catch (thrown) {
            const error = thrown instanceof Error ? thrown : new Error(String(thrown));
            this.reportRead(collectionName, error);
            return error;
        }

        emitEvent(this.onEvent, { type: 'read', ok: true, collectionName, status: 200 });
        return null;
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
                etags: 'keep',
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

    private async queueChanges(event: DbPluginBulkPersistEvent): Promise<void> {
        for (const [schemaId, changes] of event.operation) {
            if (!changes.hasItems) continue;

            const schema = event.schemas.get<UnknownRecord>(schemaId);
            assertIsNotNull(schema);

            const { adds, updates, removes } = changes;
            const schemaRecord = schema as CompiledSchema<Record<string, unknown>>;
            await this.unsyncedQueue.addMany(schema, [
                ...adds.map((entity) => ({ kind: 'add' as const, entity: entity as unknown })),
                ...updates.map((u) => ({
                    kind: 'update' as const,
                    entity: u.entity as unknown,
                    payload: buildUpdatePayload(schemaRecord, u.entity, u.delta),
                })),
                ...removes.map((entity) => ({ kind: 'remove' as const, entity: entity as unknown })),
            ]);
        }
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
        try {
            await this.queueChanges(event);
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
            if (this.postOnPersist) {
                this.flushSoon();
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
                    etags: 'keep',
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
