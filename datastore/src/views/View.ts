import { CollectionBase } from '../collections/CollectionBase';
import { IDbPlugin } from '@routier/core/plugins';
import { ChangeTrackingType, HashType, InferCreateType, InferType, SubscriptionChanges } from '@routier/core/schema';
import { BulkPersistChanges, SchemaPersistChanges } from '@routier/core/collections';
import { CallbackResult, Result } from '@routier/core/results';
import { logger, noop, uuid } from '@routier/core/utilities';
import { Derive, DeriveResponse } from './types';
import { CollectionDependencies, RequestContext } from '../collections/types';
import { SelectionQueryable } from '../queryable/SelectionQueryable';

/**
 * View that only allows data selection. Cannot add, remove, or update data.  Data is computed
 * and saved when subscriptions in the derived function change
 */
export class View<TEntity extends {}> extends CollectionBase<TEntity> {

    protected derive: Derive<TEntity>;
    protected unsubscribe: DeriveResponse;

    constructor(dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>, accumulates: boolean = false) {
        super(dependencies);

        const persist: IDbPlugin["bulkPersist"] = dependencies.plugin.bulkPersist.bind(dependencies.plugin);

        // Compute the view right away
        this.derive = (cb) => {
            return derive(data => {

                const enriched = Array.from<InferType<TEntity>>({ length: data.length });
                for (let i = 0, length = data.length; i < length; i++) {
                    enriched[i] = this.dependencies.schema.postprocess(data[i] as InferType<TEntity>, this.changeTrackingType);
                }

                /**
                 * The view's ENTIRE contents, not the rows matching the derived ids.
                 *
                 * Two reasons, and they are the same reason. A row that has LEFT the derived
                 * set has to be removed, and it cannot be found by asking for the ids that are
                 * still in it — that query returns everything except the answer. Reading the
                 * whole view is also what the previous id-list query was approximating, at the
                 * cost of an `IN` clause carrying one entry per derived row: at a hundred
                 * thousand rows that is a hundred thousand bound parameters per recompute,
                 * which most engines refuse outright.
                 *
                 * It replaces a loop that reassigned its query per id property rather than
                 * chaining, so only the LAST part of a composite key was ever filtered on.
                 */
                this.toArray(toArrayResult => {

                    if (toArrayResult.ok === "error") {
                        return cb([]);
                    }

                    const operation = new BulkPersistChanges();
                    const schemaChanges = new SchemaPersistChanges();

                    // Keyed by id-hash on both sides, so the comparison is a lookup rather
                    // than a scan, and duplicates emitted by `derive` collapse to one row —
                    // which is what a keyed table can hold anyway.
                    const derived = new Map<string, InferType<TEntity>>();
                    for (const item of enriched) {
                        derived.set(this.dependencies.schema.hash(item, HashType.Ids), item);
                    }

                    const stored = new Map<string, InferType<TEntity>>();
                    for (const existing of toArrayResult.data) {
                        stored.set(this.dependencies.schema.hash(existing, HashType.Ids), existing);
                    }

                    for (const [key, item] of derived) {
                        const existing = stored.get(key);

                        if (existing == null) {
                            schemaChanges.adds.push(item);
                            continue;
                        }

                        if (this.dependencies.schema.compare(existing, item)) {
                            continue; // Nothing has changed
                        }

                        schemaChanges.updates.push({
                            changeType: "markedDirty", // We are not sure what changed, mark it dirty
                            delta: {},
                            entity: item
                        });
                    }

                    /**
                     * Anything the view holds that the derivation no longer produces.
                     *
                     * Without this a view only ever grows. Its whole purpose is to be the
                     * subset worth keeping — one user's data out of a table with hundreds of
                     * thousands of rows — and a subset that can be joined but never left
                     * converges on the full table, which is the cost the view existed to
                     * avoid. It also silently contradicts its own definition: rows that do not
                     * satisfy the derivation keep being returned by it.
                     *
                     * Skipped for an accumulating view, which is the opposite shape on purpose
                     * — a history keyed by content hash, where each version is its own row and
                     * removing the old ones would delete the history. See
                     * `ViewBuilder.accumulate`.
                     */
                    if (accumulates === false) {
                        for (const [key, existing] of stored) {
                            if (derived.has(key) === false) {
                                schemaChanges.removes.push(existing);
                            }
                        }
                    }

                    if (schemaChanges.adds.length === 0 && schemaChanges.updates.length === 0 && schemaChanges.removes.length === 0) {
                        // Nothing to persist — the derived data already matches the view.
                        // Skipping also prevents an empty notification round trip
                        return cb(enriched);
                    }

                    operation.set(this.dependencies.schema.id, schemaChanges);

                    // Automatically save the view
                    persist({
                        id: uuid(8),
                        operation,
                        schemas: this.dependencies.schemas,
                        source: "View",
                        action: "persist"
                    }, (r) => {

                        if (r.ok === Result.ERROR) {
                            logger.error("Failed to update view", r.error);
                            return;
                        }

                        const resolvedChanges = r.data.get<TEntity>(this.dependencies.schema.id);
                        // Send the resolved adds/updates because properties might have been
                        // set by the db operation. Match-filtering per subscriber happens in
                        // DataBridge.subscribe (filtered subscriptions check changes against
                        // their filter before re-querying); unfiltered subscriptions re-query
                        // on any non-empty change, which is the accepted behavior.
                        const updates = this.cloneMany(resolvedChanges.updates);
                        const adds = this.cloneMany(resolvedChanges.adds as InferType<TEntity>[]);
                        const removals = this.cloneMany(resolvedChanges.removes);

                        const subscriptionChanges: SubscriptionChanges<TEntity> = {
                            updates,
                            adds,
                            removals,
                            unknown: []
                        };

                        // Guarded like CollectionBase.saveChanges. This used to be
                        // unconditional because view change-resolution returned empty
                        // change sets; resolution works now, so empty rounds stay silent
                        if (updates.length > 0 || adds.length > 0 || removals.length > 0) {
                            this.dependencies.subscription.send(subscriptionChanges);
                        }
                    });

                    cb(enriched);
                });
            });
        };

        // Need to create a way to unsubscribe from subscriptions in derive
        this.unsubscribe = this.derive(noop);
    }

    override dispose(): void {
        if (typeof this.unsubscribe === "function") {
            return this.unsubscribe()
        }

        for (let i = 0, length = this.unsubscribe.length; i < length; i++) {
            const fn = this.unsubscribe[i];

            fn();
        }
    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }

    emptyAsync() {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => this.empty((r) => Result.resolve(r, resolve, reject)));
    }

    empty(done: CallbackResult<InferType<TEntity>[]>) {
        const request = new RequestContext<TEntity>(this.changeTrackingType);
        const result = new SelectionQueryable<TEntity, InferType<TEntity>, void>(this.dependencies, request);
        return result.remove(done);
    }

    computeAsync() {
        return new Promise<never>((resolve, reject) => this.compute((r) => Result.resolve(r, resolve, reject)));
    }

    compute(done: CallbackResult<never>) {
        try {
            this.derive((data) => {
                this.dependencies.changeTracker.add(data as InferCreateType<TEntity>[], null, (result) => {

                    if (result.ok === "error") {
                        return done(result);
                    }

                    done(Result.success())
                });
            });
        } catch (e) {
            done(Result.error(e));
        }
    }
}