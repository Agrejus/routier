import { CallbackResult, CompiledSchema, EntityChanges, IDbPlugin, Result, ResultType, SchemaId, TrampolinePipeline } from 'routier-core';
import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines, PreviewChangesPayload, SaveChangesPayload } from './types';

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

    /**
     * Constructs a new Routier instance.
     * @param dbPlugin The database plugin to use for persistence.
     */
    constructor(dbPlugin: IDbPlugin) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.collections = new Map<SchemaId, Collection<any>>();
        this.collectionPipelines = {
            saveChanges: new TrampolinePipeline<SaveChangesPayload<unknown>>(),
            previewChanges: new TrampolinePipeline<PreviewChangesPayload<unknown>>()
        };
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (collection: Collection<TEntity>) => {
            this.collections.set(schema.id, collection)
        };
        return new CollectionBuilder<TEntity, Collection<TEntity>>({
            dbPlugin: this.dbPlugin,
            instanceCreator: Collection<TEntity>,
            isStateful: false,
            onCollectionCreated: onCreated.bind(this),
            schema,
            pipelines: this.collectionPipelines,
            signal: this.abortController.signal,
            parent: {
                allSchemas: this.getAllSchemas.bind(this)
            }
        });
    }

    /**
     * Returns all compiled schemas for the collections managed by this Routier instance.
     * @returns An array of compiled schemas.
     */
    private getAllSchemas(): CompiledSchema<any>[] {
        const result: CompiledSchema<any>[] = [];
        for (const [, value] of this.collections) {
            result.push(value.schema);
        }
        return result;
    }

    /**
     * Saves all changes in all collections.
     * @param done Callback with the number of changes saved or an error.
     */
    saveChanges(done: (result: number, error?: any) => void) {
        this.collectionPipelines.saveChanges.filter<SaveChangesPayload<unknown>>({
            count: 0,
            adds: {
                entities: []
            },
            updates: {
                changes: []
            },
            removes: {
                entities: [],
                queries: []
            },
            result: {
                adds: {
                    entities: []
                },
                removed: {
                    count: 0
                },
                updates: {
                    entities: []
                }
            }
        }, (result, error) => {
            done(result.count, error);
        });
    }

    /**
     * Saves all changes in all collections asynchronously.
     * @returns A promise resolving to the number of changes saved.
     */
    saveChangesAsync() {
        return new Promise<number>((resolve, reject) => {
            this.saveChanges((r, e) => {
                if (e != null) {
                    reject(e);
                    return;
                }
                resolve(r);
            })
        });
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @param done Callback with the entity changes or an error.
     */
    previewChanges(done: (result: EntityChanges<unknown>, error?: any) => void) {
        this.collectionPipelines.previewChanges.filter<EntityChanges<unknown>>({
            adds: {
                entities: []
            },
            updates: {
                changes: []
            },
            removes: {
                entities: [],
                queries: []
            }
        }, done);
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     */
    previewChangesAsync(): Promise<EntityChanges<unknown>> {
        return new Promise<EntityChanges<unknown>>((resolve, reject) => {
            this.previewChanges((r, e) => {
                if (e != null) {
                    reject(e);
                    return;
                }
                resolve(r);
            })
        });
    }

    /**
     * Checks if there are any unsaved changes in the collections.
     * @param done Callback with the result (true if there are changes) or an error.
     */
    hasChanges(done: (result: ResultType<boolean>) => void) {
        try {
            for (const [, collection] of this.collections) {
                if (collection.hasChanges()) {
                    done({
                        ok: true,
                        data: true
                    });
                    return;
                }
            }

            done({
                ok: true,
                data: false
            });
        } catch (error) {
            done({
                ok: false,
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

                if (r.ok === false) {
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