import { CollectionBase } from '../collections/CollectionBase';
import { IDbPlugin } from '@routier/core/plugins';
import { ChangeTrackingType, CompiledSchema, HashType, IdType, InferCreateType, InferType, SubscriptionChanges } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection, SchemaPersistChanges } from '@routier/core/collections';
import { CallbackResult, Result } from '@routier/core/results';
import { logger, noop, uuid } from '@routier/core/utilities';
import { QueryableAsync } from '../queryable/QueryableAsync';
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

    constructor(dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>) {
        super(dependencies);

        const persist: IDbPlugin["bulkPersist"] = dependencies.plugin.bulkPersist.bind(dependencies.plugin);

        // Compute the view right away
        this.derive = (cb) => {
            return derive(data => {

                if (data.length === 0) {
                    return cb([]);
                }

                const enriched = new Array<InferType<TEntity>>(data.length);
                for (let i = 0, length = data.length; i < length; i++) {
                    enriched[i] = this.dependencies.schema.postprocess(data[i] as InferType<TEntity>, this.changeTrackingType);
                }

                const idProperties = this.dependencies.schema.idProperties;
                let query: QueryableAsync<TEntity, InferType<TEntity>>;

                for (let i = 0, length = idProperties.length; i < length; i++) {
                    const idProperty = idProperties[i];
                    const ids = enriched.map(x => (x as Record<string, IdType>)[idProperty.name]);

                    query = this.where(([x, p]) => p.ids.includes((x as Record<string, IdType>)[p.name]), { ids, name: idProperty.name });
                }

                query.toArray(toArrayResult => {

                    if (toArrayResult.ok === "error") {
                        return cb([]);
                    }

                    const operation = new BulkPersistChanges();
                    const schemaChanges = new SchemaPersistChanges();

                    if (toArrayResult.data.length === 0) {
                        schemaChanges.adds = enriched;
                    } else {

                        // Build lookup map for O(1) lookups instead of O(n) find()
                        const existingMap = new Map<string, InferType<TEntity>>();
                        for (const existing of toArrayResult.data) {
                            const hash = this.dependencies.schema.hash(existing, HashType.Ids);
                            existingMap.set(hash, existing);
                        }

                        // compute changes
                        for (let i = 0, length = enriched.length; i < length; i++) {
                            const item = enriched[i];
                            const hash = this.dependencies.schema.hash(item, HashType.Ids);
                            const existing = existingMap.get(hash);

                            if (existing != null) {

                                if (this.dependencies.schema.compare(existing, item)) {
                                    continue; // Nothing has changed
                                }

                                schemaChanges.updates.push({
                                    changeType: "markedDirty", // We are not sure what changed, mark it dirty
                                    delta: {},
                                    entity: item
                                });
                                continue;
                            }
                            schemaChanges.adds.push(item);
                        }
                    }

                    operation.set(this.dependencies.schema.id, schemaChanges);

                    // Automatically save the view
                    persist({
                        id: uuid(8),
                        operation,
                        schemas: this.dependencies.schemas,
                        source: "view"
                    }, (r) => {

                        if (r.ok === Result.ERROR) {
                            logger.error("Failed to update view", r.error);
                            return;
                        }

                        const resolvedChanges = r.data.get<TEntity>(this.dependencies.schema.id);
                        // we only want to notify of changes when an item that was saved matches the query
                        // these get reset each time
                        // send in the resulting adds because properties might have been set from the db operation
                        const updates = this.cloneMany(resolvedChanges.updates);
                        const adds = this.cloneMany(resolvedChanges.adds as InferType<TEntity>[]);
                        const removals = this.cloneMany(resolvedChanges.removes);

                        const subscriptionChanges: SubscriptionChanges<TEntity> = {
                            updates,
                            adds,
                            removals,
                            unknown: []
                        };

                        this.dependencies.subscription.send(subscriptionChanges);
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
        const request = new RequestContext<TEntity>();
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