import { CollectionBase } from '../collections/CollectionBase';
import { Derive, DeriveResponse } from '../view-builder/ViewBuilder';
import { CollectionOptions, CollectionPipelines } from '../types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { ChangeTrackingType, CompiledSchema, IdType, InferCreateType, InferType, SubscriptionChanges } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection, SchemaPersistChanges } from '@routier/core/collections';
import { CallbackResult, noop, Result, uuid } from '@routier/core';
import { QueryableAsync } from '../queryable/QueryableAsync';

/**
 * View that only allows data selection. Cannot add, remove, or update data.  Data is computed
 * and saved when subscriptions in the derived function change
 */
export class View<TEntity extends {}> extends CollectionBase<TEntity> {

    protected derive: Derive<TEntity>;
    protected persist: IDbPlugin["bulkPersist"];
    protected unsubscribe: DeriveResponse;

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: SchemaCollection,
        scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>,
        derive: Derive<TEntity>,
        persist: IDbPlugin["bulkPersist"]
    ) {
        super(dbPlugin, schema, options, pipelines, schemas, scopedQueryOptions);

        // Compute the view right away
        this.derive = (cb) => {
            return derive(data => {

                if (data.length === 0) {
                    return cb([]);
                }

                const enriched = new Array<InferType<TEntity>>(data.length);
                for (let i = 0, length = data.length; i < length; i++) {
                    enriched[i] = this.schema.postprocess(data[i] as InferType<TEntity>, this.changeTrackingType);
                }

                const idProperties = this.schema.idProperties;
                let query: QueryableAsync<InferType<TEntity>, InferType<TEntity>>;

                for (let i = 0, length = idProperties.length; i < length; i++) {
                    const idProperty = idProperties[i];
                    const ids = enriched.map(x => (x as Record<string, IdType>)[idProperty.name]);

                    query = this.where(([x, p]) => p.ids.includes((x as Record<string, IdType>)[p.name]), { ids, name: idProperty.name });
                }

                query.toArray(toArrayResult => {

                    if (toArrayResult.ok === "error") {
                        return cb([]);
                    }

                    const schemas = new SchemaCollection();

                    schemas.set(this.schema.id, this.schema as CompiledSchema<Record<string, unknown>>);
                    const operation = new BulkPersistChanges();
                    const schemaChanges = new SchemaPersistChanges();

                    if (toArrayResult.data.length === 0) {
                        schemaChanges.adds = enriched;
                    } else {

                        // compute changes
                        for (let i = 0, length = enriched.length; i < length; i++) {
                            const item = enriched[i];
                            const existing = toArrayResult.data.find(x => this.schema.compareIds(item, x))

                            if (existing != null) {

                                if (this.schema.compare(existing, item)) {
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

                    operation.set(this.schema.id, schemaChanges);

                    // Automatically save the view
                    persist({
                        id: uuid(8),
                        operation,
                        schemas,
                        source: "view"
                    }, (r) => {

                        if (r.ok === Result.ERROR) {
                            console.error("Failed to update view", r.error);
                            return;
                        }

                        const resolvedChanges = r.data.get<TEntity>(this.schema.id);
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

                        this.subscription.send(subscriptionChanges);
                    });

                    cb(enriched);
                });
            });
        };

        // Need to create a way to unsubscribe from subscriptions in derive
        this.unsubscribe = this.derive(noop);
        this.persist = persist;
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
        return new Promise<never>((resolve, reject) => this.empty((r) => Result.resolve(r, resolve, reject)));
    }

    empty(done: CallbackResult<never>) {
        try {

            this.changeTracker.removeByQuery({
                changeTracking: false,
                options: this.scopedQueryOptions as unknown as QueryOptionsCollection<TEntity>,
                schema: this.schema
            }, null, (result) => {

                if (result.ok === "error") {
                    return done(result);
                }

                done(Result.success())
            });
        } catch (e) {
            done(Result.error(e));
        }
    }

    computeAsync() {
        return new Promise<never>((resolve, reject) => this.compute((r) => Result.resolve(r, resolve, reject)));
    }

    compute(done: CallbackResult<never>) {
        try {
            this.derive((data) => {
                this.changeTracker.add(data as InferCreateType<TEntity>[], null, (result) => {

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