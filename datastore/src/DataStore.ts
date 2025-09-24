import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines } from './types';
import { IDbPlugin } from '@routier/core/plugins';
import { CompiledSchema, SchemaId } from '@routier/core/schema';
import { TrampolinePipeline } from '@routier/core/pipeline';
import { CallbackPartialResult, CallbackResult, PartialResultType, PluginEventResult, Result } from '@routier/core/results';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, ReadonlySchemaCollection } from '@routier/core/collections';
import { UnknownRecord, uuid } from '@routier/core/utilities';
import { View } from './views/View';
import { ViewBuilder } from './view-builder/ViewBuilder';
import { CollectionBase } from './collections/CollectionBase';

/**
 * The main Routier class, providing collection management, change tracking, and persistence for entities.
 *
 * @implements Disposable
 */
export class DataStore implements Disposable {

    /** The underlying database plugin used for persistence. */
    protected readonly dbPlugin: IDbPlugin;
    /** Map of schema key to collection instances. */
    protected readonly collections: Map<SchemaId, CollectionBase<any>>;
    /** Pipelines for save and hasChanges operations. */
    protected readonly collectionPipelines: CollectionPipelines;
    /** AbortController for managing cancellation and disposal. */
    protected readonly abortController: AbortController;

    protected readonly _schemas: SchemaCollection;

    get schemas() {
        return new ReadonlySchemaCollection([...this._schemas]);
    }

    /**
     * Constructs a new Routier instance.
     * @param dbPlugin The database plugin to use for persistence.
     */
    constructor(dbPlugin: IDbPlugin) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.collections = new Map<SchemaId, CollectionBase<any>>();
        this._schemas = new SchemaCollection();
        this.collectionPipelines = {
            prepareChanges: new TrampolinePipeline<PartialResultType<BulkPersistChanges>>(),
            afterPersist: new TrampolinePipeline<PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }>>(),
        };
    }

    getDbPlugin<T extends IDbPlugin>() {
        return this.dbPlugin as T;
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (collection: Collection<TEntity>) => {
            this.collections.set(schema.id, collection);
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };
        return new CollectionBuilder<TEntity, Collection<TEntity>>({
            dbPlugin: this.dbPlugin,
            instanceCreator: Collection<TEntity>,
            onCollectionCreated: onCreated.bind(this),
            schema,
            pipelines: this.collectionPipelines,
            signal: this.abortController.signal,
            schemas: this._schemas
        });
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected view<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (view: View<TEntity>) => {
            this.collections.set(schema.id, view);
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };
        return new ViewBuilder<TEntity, View<TEntity>>({
            dbPlugin: this.dbPlugin,
            instanceCreator: View<TEntity>,
            onCollectionCreated: onCreated.bind(this),
            schema,
            pipelines: this.collectionPipelines,
            signal: this.abortController.signal,
            schemas: this._schemas,
            persistCallback: this.dbPlugin.bulkPersist.bind(this.dbPlugin),
            deriveCallback: () => void (0)
        });
    }

    /**
     * Saves all changes in all collections.
     * @param done Callback with the number of changes saved or an error.
     */
    saveChanges(done: CallbackPartialResult<BulkPersistResult>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<BulkPersistChanges>>({
            data: new BulkPersistChanges(),
            ok: Result.SUCCESS
        }, (preparedChangesResult) => {

            // fatal error
            if (preparedChangesResult.ok === PluginEventResult.ERROR) {
                done(preparedChangesResult);
                return;
            }

            try {
                this.dbPlugin.bulkPersist({
                    id: uuid(8),
                    operation: preparedChangesResult.data,
                    schemas: this._schemas,
                    source: "data-store"
                }, (bulkPersistResult) => {

                    if (bulkPersistResult.ok === Result.ERROR) {
                        done(Result.error(bulkPersistResult.error))
                        return;
                    }

                    if (bulkPersistResult.ok === Result.PARTIAL) {
                        done(Result.partial(bulkPersistResult.data, bulkPersistResult.error));
                        return;
                    }

                    this.collectionPipelines.afterPersist.filter<PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }>>({
                        data: { changes: preparedChangesResult.data, result: bulkPersistResult.data },
                        ok: Result.SUCCESS
                    }, (afterPersistResult) => {

                        if (afterPersistResult.ok === PluginEventResult.ERROR) {
                            done(PluginEventResult.error(bulkPersistResult.id, afterPersistResult.error));
                            return;
                        }

                        // need to compute views if any

                        if (afterPersistResult.ok === PluginEventResult.PARTIAL) {
                            done(PluginEventResult.partial(bulkPersistResult.id, afterPersistResult.data.result, afterPersistResult.error));
                            return;
                        }

                        done(PluginEventResult.success(bulkPersistResult.id, afterPersistResult.data.result))
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
        return new Promise<BulkPersistResult>((resolve, reject) => {
            this.saveChanges((r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @param done Callback with the entity changes or an error.
     */
    previewChanges(done: CallbackPartialResult<BulkPersistChanges>) {
        this.collectionPipelines.prepareChanges.filter<PartialResultType<BulkPersistChanges>>({
            data: new BulkPersistChanges(),
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
        return new Promise<BulkPersistChanges>((resolve, reject) => {
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
        this.dbPlugin.destroy({
            id: uuid(8),
            schemas: this._schemas,
            source: "data-store"
        }, done);
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