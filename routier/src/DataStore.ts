import { CallbackPartialResult, CallbackResult, CompiledSchema, IDbPlugin, PartialResultType, Result, SchemaId, TrampolinePipeline } from 'routier-core';
import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines } from './types';
import { CollectionChanges, CollectionChangesResult } from 'routier-core/dist/plugins/types';

/**
 * The main Routier class, providing collection management, change tracking, and persistence for entities.
 *
 * @implements Disposable
 */
export class DataStore implements Disposable {

    /** The underlying database plugin used for persistence. */
    protected readonly dbPlugin: IDbPlugin;
    /** Map of schema key to collection instances. */
    protected readonly collections: Map<SchemaId, Collection<any>>;
    /** Pipelines for save and hasChanges operations. */
    protected readonly collectionPipelines: CollectionPipelines;
    /** AbortController for managing cancellation and disposal. */
    protected readonly abortController: AbortController;
    protected readonly schemas: Map<SchemaId, CompiledSchema<any>>;

    /**
     * Constructs a new Routier instance.
     * @param dbPlugin The database plugin to use for persistence.
     */
    constructor(dbPlugin: IDbPlugin) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.collections = new Map<SchemaId, Collection<any>>();
        this.collectionPipelines = {
            prepareChanges: new TrampolinePipeline<PartialResultType<Map<SchemaId, { changes: CollectionChanges<any> }>>>(),
            afterPersist: new TrampolinePipeline<PartialResultType<Map<SchemaId, { changes: CollectionChanges<any>, result: CollectionChangesResult<any> }>>>(),
        };
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (collection: Collection<TEntity>) => {
            this.collections.set(schema.id, collection);
            this.schemas.set(schema.id, schema);
        };
        return new CollectionBuilder<TEntity, Collection<TEntity>>({
            dbPlugin: this.dbPlugin,
            instanceCreator: Collection<TEntity>,
            isStateful: false,
            onCollectionCreated: onCreated.bind(this),
            schema,
            pipelines: this.collectionPipelines,
            signal: this.abortController.signal,
            schemas: this.schemas
        });
    }

    /**
     * SaveChangesTransaction
     * adds: {
     * }
     */

    /**
     * Saves all changes in all collections.
     * @param done Callback with the number of changes saved or an error.
     */
    saveChanges(done: CallbackPartialResult<Map<SchemaId, { changes: CollectionChanges<any>, result: CollectionChangesResult<any>, }>>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<Map<SchemaId, { changes: CollectionChanges<any> }>>>({
            data: new Map<SchemaId, { changes: CollectionChanges<any> }>(),
            ok: Result.SUCCESS
        }, (result) => {

            if (result.ok === Result.ERROR) {
                done(result);
                return;
            }

            try {
                this.dbPlugin.bulkPersist({
                    operation: result.data,
                    schemas: this.schemas
                }, (r) => {

                    if (r.ok === Result.ERROR) {
                        done(Result.error(r.error))
                        return;
                    }

                    if (r.ok === Result.PARTIAL) {
                        // for (const [schemaId] of r.data) {
                        //     const collection = this.collections.get(schemaId);

                        //     // destroy tags on even on failure
                        //     collection.tags.destroy();
                        // }
                        done(r);
                        return;
                    }


                });
            } catch (e) {
                done(Result.error(e))
            }
        });
    }

    /**
     * Saves all changes in all collections asynchronously.
     * @returns A promise resolving to the number of changes saved.
     */
    saveChangesAsync() {
        return new Promise<Map<SchemaId, { changes: CollectionChanges<any>, result: CollectionChangesResult<any> }>>((resolve, reject) => {
            this.saveChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @param done Callback with the entity changes or an error.
     */
    previewChanges(done: CallbackResult<Map<SchemaId, { changes: CollectionChanges<any> }>>) {
        this.collectionPipelines.prepareChanges.filter<Map<SchemaId, { changes: CollectionChanges<any> }>>({
            data: new Map<SchemaId, { changes: CollectionChanges<any> }>(),
            ok: Result.SUCCESS
        }, (r, e) => {
            if (e != null) {
                done(Result.error(e));
                return;
            }

            done(Result.success(r));
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     */
    previewChangesAsync() {
        return new Promise<Map<SchemaId, { changes: CollectionChanges<any> }>>((resolve, reject) => {
            this.previewChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Checks if there are any unsaved changes in the collections.
     * @param done Callback with the result (true if there are changes) or an error.
     */
    hasChanges(done: CallbackResult<boolean>) {
        try {
            for (const [, collection] of this.collections) {
                if (collection.hasChanges()) {
                    done({
                        ok: Result.SUCCESS,
                        data: true
                    });
                    return;
                }
            }

            done({
                ok: Result.SUCCESS,
                data: false
            });
        } catch (error) {
            done({
                ok: Result.ERROR,
                error
            });
        }
    }

    /**
     * Checks asynchronously if there are any unsaved changes in the collections.
     * @returns A promise resolving to true if there are changes, false otherwise.
     */
    hasChangesAsync() {
        return new Promise<boolean>((resolve, reject) => {
            this.hasChanges((r) => {

                if (r.ok === Result.ERROR) {
                    reject(r.error);
                    return;
                }

                resolve(r.data);
            })
        });
    }

    /**
     * Destroys the Routier instance and underlying database plugin.
     * @param done Callback with an optional error.
     */
    destroy(done: CallbackResult<never>) {
        this.dbPlugin.destroy(done);
    }

    /**
     * Destroys the Routier instance and underlying database plugin asynchronously.
     * @returns A promise that resolves when destruction is complete.
     */
    destroyAsync() {
        return new Promise<void>((resolve, reject) => {
            this.destroy((r) => Result.resolve(r, resolve, reject))
        });
    }

    /**
     * Disposes the Routier instance, aborting any ongoing operations and subscriptions.
     */
    [Symbol.dispose]() {
        this.abortController.abort("Data Store disposed");
    }
}