import { CallbackPartialResult, CallbackResult, CompiledSchema, IDbPlugin, PartialResultType, PendingChanges, ResolvedChanges, Result, SchemaId, TrampolinePipeline } from 'routier-core';
import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines } from './types';

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
        this.schemas = new Map<SchemaId, CompiledSchema<any>>();
        this.collectionPipelines = {
            prepareChanges: new TrampolinePipeline<PartialResultType<PendingChanges<any>>>(),
            afterPersist: new TrampolinePipeline<PartialResultType<ResolvedChanges<any>>>(),
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
     * Saves all changes in all collections.
     * @param done Callback with the number of changes saved or an error.
     */
    saveChanges(done: CallbackPartialResult<ResolvedChanges<any>>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<ResolvedChanges<any>>>({
            data: new ResolvedChanges<any>(),
            ok: Result.SUCCESS
        }, (result, e) => {

            // fatal error
            if (e != null) {
                done(Result.error(e));
                return;
            }

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
                        done(Result.partial(r.data, r.error));
                        return;
                    }

                    this.collectionPipelines.afterPersist.filter<PartialResultType<ResolvedChanges<any>>>({
                        data: r.data,
                        ok: Result.SUCCESS
                    }, (afterPersistResult, afterPersistError) => {

                        if (afterPersistError != null) {
                            done(Result.error(afterPersistError));
                            return;
                        }

                        done(afterPersistResult);
                    });
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
        return new Promise<ResolvedChanges<any>>((resolve, reject) => {
            this.saveChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @param done Callback with the entity changes or an error.
     */
    previewChanges(done: CallbackPartialResult<PendingChanges<any>>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<PendingChanges<any>>>({
            data: new PendingChanges<any>(),
            ok: Result.SUCCESS
        }, (r, e) => {
            if (e != null) {
                done(Result.error(e));
                return;
            }

            done(r);
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     */
    previewChangesAsync() {
        return new Promise<PendingChanges<any>>((resolve, reject) => {
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
        // should clear and detach everything in the change tracker?
        this.abortController.abort("Data Store disposed");
    }
}