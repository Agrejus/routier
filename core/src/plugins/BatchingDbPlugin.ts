import { BulkPersistChanges, BulkPersistResult, SchemaCollection, SchemaPersistResult } from "../collections";
import { PluginDestroyedError } from "../errors";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventPartialResultType, PluginEventPartialType, PluginEventResult, PluginEventSuccessType } from "../results";
import { SchemaId } from "../schema";
import { ITranslatedValue } from "./translators";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin } from "./types";
import { uuid } from "../utilities";

export type BatchingDbPluginOptions = {
    /**
     * The caller PROMISING that a failed `bulkPersist` beneath this wrapper leaves NOTHING
     * applied. Only then may separate callers' saves be merged into one write, because the
     * failure path re-runs a failed batch item by item — and re-running a HALF-APPLIED batch
     * applies the landed items twice, which for adds means duplicate rows under fresh
     * identities, with nothing raised.
     *
     * Omitted, the wrapper still queues and serializes; it just writes batches of one, which
     * is what happens without it in the stack at all. True of SQLite, PostgreSQL and MySQL —
     * one transaction, rolled back entire. Not true of anything that applies writes as it
     * goes without a way to undo them.
     */
    isAtomic?: boolean;
    /**
     * The most writes one drain may take. Default 100.
     *
     * A drain takes everything waiting, so a burst puts an unbounded statement set in one
     * transaction — and some engines cap that outright, D1's `batch()` in particular. Taking N
     * per pass changes none of the reasoning: the remainder is still waiting, the next drain
     * runs the moment this one returns, and a batch is still only what had already arrived.
     *
     * It also bounds the failure fallback, which costs N+1 writes for a failing batch of N.
     */
    maxBatchSize?: number;
};

const DEFAULT_MAX_BATCH_SIZE = 100;

/** A caller's write, waiting its turn. */
type QueuedWrite = {
    readonly event: DbPluginBulkPersistEvent;
    readonly done: PluginEventCallbackPartialResult<BulkPersistResult>;
};

/**
 * A batch of writes that may go out as ONE, with the merged event already built.
 * `items` is kept so a failure can re-run them individually and so results can be split back.
 */
type PreparedGroup = {
    readonly items: QueuedWrite[];
    readonly event: DbPluginBulkPersistEvent;
};

/**
 * Coalesces overlapping writes into single round trips.
 *
 * ## Why
 *
 * One logical change produces more than one write: the caller's `saveChanges`, then every view
 * reconciling in response to it. A store with three views issues four writes, none coordinated
 * with the others. On a local file that is invisible; against a server the round trip dominates
 * everything else a save does.
 *
 * ## The shape, and why it cannot cost anything
 *
 * A write arrives and joins the queue. If one is already in flight, the running drain will take
 * it. Otherwise drain immediately: take everything waiting up to `maxBatchSize` and write it,
 * then drain again for whatever arrived meanwhile and whatever the ceiling left behind.
 *
 * Nothing polls, nothing sleeps, nothing waits for a batch to fill. **A batch is only what had
 * already arrived**, so when writes do not overlap the queue is empty, the batch is one item,
 * and the write is byte for byte what happens without this wrapper. Latency cannot increase;
 * throughput improves exactly when there is contention to improve.
 *
 * ## What may be merged
 *
 * Only items whose schemas do not overlap, and only with `isAtomic`. Two writes to one
 * collection are genuinely ordered — a plugin applies removes, then updates, then adds WITHIN a
 * schema, so merging an add of a row with a later update of it would run the update first,
 * against a row that does not exist yet, and lose it silently. Items sharing a schema therefore
 * go in separate writes, in arrival order.
 *
 * That same rule is what lets a merged result be split back by SCHEMA rather than by position:
 * each schema in a merged write came from exactly one item, so no assumption about the order a
 * plugin echoes rows in is needed anywhere.
 *
 * @see specs/write-batching.md
 */
export class BatchingDbPlugin implements IDbPlugin {

    private readonly plugin: IDbPlugin;
    private readonly canMerge: boolean;
    private readonly maxBatchSize: number;

    private readonly queue: QueuedWrite[] = [];
    private isWriting = false;
    private isDestroyed = false;
    /** Set when `destroy` arrives mid-write; run once the in-flight batch settles. */
    private onSettled: (() => void) | null = null;

    constructor(plugin: IDbPlugin, options: BatchingDbPluginOptions = {}) {
        this.plugin = plugin;
        this.canMerge = options.isAtomic === true;
        // Floored at 1: a ceiling of zero would take nothing and drain forever.
        this.maxBatchSize = Math.max(1, options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
    }

    get databaseName(): string {
        return this.plugin.databaseName;
    }

    /** Reads are not batched: they have no lock to contend for and no ordering to preserve. */
    query<TRoot extends {}, TShape extends any = TRoot>(
        event: DbPluginQueryEvent<TRoot, TShape>,
        done: PluginEventCallbackResult<ITranslatedValue<TShape>>
    ): void {
        this.plugin.query(event, done);
    }

    bulkPersist(
        event: DbPluginBulkPersistEvent,
        done: PluginEventCallbackPartialResult<BulkPersistResult>
    ): void {

        if (this.isDestroyed) {
            // Fails rather than passing through. The queue's contract is that an accepted write
            // is eventually answered by a live drain loop, and there is no loop left; passing it
            // down is worse still, since a plugin that creates missing tables would recreate the
            // database the destroy just deleted and report success against an empty one.
            done(PluginEventResult.error(event.id, new PluginDestroyedError("write submitted after destroy")));
            return;
        }

        this.queue.push({ event, done });

        // In flight: the continuation below takes this one. Doing anything else here is what
        // turns a queue into a race.
        if (this.isWriting) {
            return;
        }

        this.drain();
    }

    /**
     * Destroys the inner plugin, answering everything this wrapper is holding first.
     *
     * `destroy` is destructive rather than graceful — the SQLite plugin deletes the database —
     * so draining first would spend round trips producing state the next call destroys, and
     * the drain loop refills, making teardown unbounded. Queued items are therefore failed
     * rather than flushed.
     *
     * An in-flight write is a different matter: it has already been sent, destroying cannot
     * un-send it, and its callers are owed the real result. So the inner `destroy` waits for it
     * to settle — dropping a `deleteDatabase` on top of an open transaction is its own failure.
     */
    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.isDestroyed = true;

        for (const item of this.queue.splice(0)) {
            this.answer(item, PluginEventResult.error(
                item.event.id,
                new PluginDestroyedError("destroyed before the write was attempted")
            ));
        }

        const forward = () => this.plugin.destroy(event, done);

        if (this.isWriting) {
            this.onSettled = forward;
            return;
        }

        forward();
    }

    /**
     * Takes everything waiting and writes it, then schedules itself again for whatever arrived
     * while that ran.
     */
    private drain(): void {
        // Not everything — up to the ceiling. Whatever is left stays queued for the next pass,
        // which starts as soon as this one returns.
        const batch = this.queue.splice(0, this.maxBatchSize);

        if (batch.length === 0) {
            this.isWriting = false;

            const settled = this.onSettled;

            if (settled != null) {
                this.onSettled = null;
                settled();
            }

            return;
        }

        this.isWriting = true;

        // The latch's only way down. Every path below MUST reach it: an exception that escaped
        // would leave `isWriting` stuck true and every future write queued forever — a total,
        // silent write outage that nothing else would report.
        const next = () => this.drain();

        let groups: PreparedGroup[];

        try {
            groups = this.prepare(batch);
        } catch (error) {
            // A throw here is a bug in this wrapper rather than a backend failure, and — because
            // preparing is pure and happens BEFORE any write is issued — nothing has been
            // applied. Degrading to one write per item is exactly what not batching does.
            //
            // This is also why the guard stops here and does not cover `writeGroups`. If group 1
            // had already landed, re-running the batch item by item would apply it twice, which
            // is the hazard `isAtomic` exists to rule out.
            this.writeIndividually(batch, next);
            return;
        }

        this.writeGroups(groups, 0, next);
    }

    /**
     * Partitions the batch, APPEND-ONLY: an item joins the last group if none of its schemas is
     * claimed there, and otherwise closes that group and starts a new one.
     *
     * Not first-fit. Scanning every open group for one an item fits merges more, and reorders
     * doing it: with arrivals A(schema S), B(schema S), C(schema T), first-fit would put C in
     * A's group and write it before the earlier-arrived B. Nothing is lost inside a table, but a
     * caller who saved B before C could observe C land first. The last-group rule keeps arrival
     * order unconditionally — everything in group N arrived before everything in group N+1 — and
     * on the case that matters, several views over distinct schemas, both rules produce the same
     * single group.
     */
    private prepare(batch: QueuedWrite[]): PreparedGroup[] {
        const groups: QueuedWrite[][] = [];
        let claimed = new Set<SchemaId>();

        for (const item of batch) {
            const schemas = [...item.event.operation.keys()];
            const overlaps = schemas.some(schemaId => claimed.has(schemaId));

            if (groups.length === 0 || overlaps || this.canMerge === false) {
                groups.push([item]);
                claimed = new Set(schemas);
                continue;
            }

            groups[groups.length - 1].push(item);

            for (const schemaId of schemas) {
                claimed.add(schemaId);
            }
        }

        return groups.map(items => ({ items, event: this.mergeEvents(items) }));
    }

    /**
     * One event standing for several. Synthetic THROUGHOUT: its own id, its operation the union
     * of the items' operations, and its schemas the union of theirs — a plugin resolving
     * `event.schemas.get(schemaId)` must find every schema any item brought.
     *
     * A single-item group passes its own event through untouched. That is most writes, so the
     * uncontended path never reaches the merging machinery at all.
     */
    private mergeEvents(items: QueuedWrite[]): DbPluginBulkPersistEvent {

        if (items.length === 1) {
            return items[0].event;
        }

        const operation = new BulkPersistChanges();
        const schemas = new SchemaCollection();

        for (const item of items) {
            for (const [schemaId, changes] of item.event.operation) {
                operation.set(schemaId, changes);
            }

            for (const [schemaId, schema] of item.event.schemas) {
                schemas.set(schemaId, schema);
            }
        }

        return {
            ...items[0].event,
            // Its own id: no caller has ever seen this one, and nothing upstream may be handed it.
            id: uuid(16),
            source: "BatchingDbPlugin",
            reason: `merged ${items.length} writes`,
            operation,
            schemas,
        };
    }

    /** Groups go out in order, because two writes to one collection are genuinely ordered. */
    private writeGroups(groups: PreparedGroup[], index: number, next: () => void): void {

        if (index >= groups.length) {
            next();
            return;
        }

        const group = groups[index];
        const advance = () => this.writeGroups(groups, index + 1, next);

        const attempt = (result: PluginEventPartialResultType<BulkPersistResult>) => {

            if (result.ok === PluginEventResult.ERROR) {

                if (group.items.length === 1) {
                    this.answer(group.items[0], result);
                    advance();
                    return;
                }

                // Coupled failure, unpicked: one caller's bad data must not fail its
                // batchmates, so the batch is re-run item by item. Costs N+1 writes for a
                // failing batch of N, paid only when something is already going wrong. Safe
                // only because `isAtomic` promised the failed batch left nothing applied.
                this.writeIndividually(group.items, advance);
                return;
            }

            this.split(group, result);
            advance();
        };

        try {
            this.plugin.bulkPersist(group.event, attempt);
        } catch (error) {
            attempt(PluginEventResult.error(group.event.id, error));
        }
    }

    /**
     * Hands each item its own slice of a merged result, keyed by SCHEMA.
     *
     * Disjoint schemas are what make this possible: each schema in the write came from exactly
     * one item, so there is no counting, no slicing by position, and no reliance on the order a
     * plugin echoes rows in — an assumption that is load-bearing elsewhere and would be SILENT
     * here, handing one caller another's database-assigned identities.
     */
    private split(
        group: PreparedGroup,
        result: PluginEventSuccessType<BulkPersistResult> | PluginEventPartialType<BulkPersistResult>
    ): void {

        if (group.items.length === 1) {
            this.answer(group.items[0], result);
            return;
        }

        const merged = result.data;
        // A PARTIAL from an inner plugin that promised atomicity should not happen. If it does,
        // every caller is told — splitting the data but reporting the error to all of them,
        // rather than retrying. Retrying is what would be unsafe here: partial means something
        // already landed, and re-running it applies that twice.
        const isPartial = result.ok === PluginEventResult.PARTIAL;

        for (const item of group.items) {
            const mine = new BulkPersistResult();

            for (const schemaId of item.event.operation.keys()) {
                // A schema the plugin had nothing to echo for gets an empty result, never a hole.
                mine.set(schemaId, merged?.get(schemaId) ?? new SchemaPersistResult());
            }

            // Answered under ITS OWN event id — the merged write ran under a synthetic one.
            this.answer(item, isPartial
                ? PluginEventResult.partial(item.event.id, mine, (result as PluginEventPartialType<BulkPersistResult>).error)
                : PluginEventResult.success(item.event.id, mine));
        }
    }

    /** One write per item, in arrival order — what happens with no batching at all. */
    private writeIndividually(items: QueuedWrite[], next: () => void): void {

        const run = (index: number): void => {

            if (index >= items.length) {
                next();
                return;
            }

            const item = items[index];
            const advance = () => run(index + 1);

            try {
                this.plugin.bulkPersist(item.event, result => {
                    this.answer(item, result);
                    advance();
                });
            } catch (error) {
                this.answer(item, PluginEventResult.error(item.event.id, error));
                advance();
            }
        };

        run(0);
    }

    /**
     * A caller's callback, guarded. One caller's `done` throwing must not eat its batchmates'
     * results, and must not strand the latch — which it would, since the continuation runs
     * after the answers.
     */
    private answer(item: QueuedWrite, result: PluginEventPartialResultType<BulkPersistResult>): void {
        try {
            item.done(result);
        } catch (error) {
            // Nobody left to tell: the caller we would report to is the one that threw.
        }
    }
}
