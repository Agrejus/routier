import { CollectionBase } from '../collections/CollectionBase';
import { DeriveCallback } from '../view-builder/ViewBuilder';
import { CollectionOptions, CollectionPipelines } from '../types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { ChangeTrackingType, CompiledSchema, InferCreateType, InferType } from '@routier/core/schema';
import { BulkPersistChanges, SchemaCollection, SchemaPersistChanges } from '@routier/core/collections';
import { CallbackResult, noop, Result, uuid } from '@routier/core';

/**
 * View that only allows data selection. Cannot add, remove, or update data.  Data is computed
 * and saved when subscriptions in the derived function change
 */
export class View<TEntity extends {}> extends CollectionBase<TEntity> {

    protected derive: (callback: DeriveCallback<TEntity>) => void;
    protected persist: IDbPlugin["bulkPersist"];

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: SchemaCollection,
        scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>,
        derive: (callback: DeriveCallback<TEntity>) => void,
        persist: IDbPlugin["bulkPersist"]
    ) {
        super(dbPlugin, schema, options, pipelines, schemas, scopedQueryOptions);

        // Compute the view right away
        this.derive = (cb) => {

            derive((data) => {
                const schemas = new SchemaCollection();

                schemas.set(this.schema.id, this.schema as CompiledSchema<Record<string, unknown>>);
                const operation = new BulkPersistChanges();
                const schemaChanges = new SchemaPersistChanges();
                schemaChanges.adds = data;

                operation.set(this.schema.id, schemaChanges);

                persist({
                    id: uuid(8),
                    operation,
                    schemas,
                    source: "view"
                }, noop);

                cb(data);
            });
        };

        this.derive(noop);
        this.persist = persist;
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