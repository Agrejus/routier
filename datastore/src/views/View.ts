import { CollectionBase } from '../collections/CollectionBase';
import { DeriveCallback } from '../view-builder/ViewBuilder';
import { CollectionOptions, CollectionPipelines } from '../types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { ChangeTrackingType, CompiledSchema, InferCreateType, InferType } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection } from '@routier/core/collections';
import { CallbackPartialResult, CallbackResult, PartialResultType, Result } from '@routier/core';

// When do we save?  When we recompute the view, we do not know when it is done.  Then we still need to persist the view.
// Maybe make them memory only so we do not need to worry about persistence

/**
 * View that only allows data selection. Cannot add, remove, or update data.
 */
export class View<TEntity extends {}> extends CollectionBase<TEntity> {

    protected derive: (callback: DeriveCallback<TEntity>) => void;

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: SchemaCollection,
        scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>,
        derive: (callback: DeriveCallback<TEntity>) => void
    ) {
        super(dbPlugin, schema, options, pipelines, schemas, scopedQueryOptions)
        this.derive = derive;
    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }

    protected override prepare(result: PartialResultType<BulkPersistChanges>, done: CallbackPartialResult<BulkPersistChanges>): void {

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