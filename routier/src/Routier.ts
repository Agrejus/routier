import { CompiledSchema, IDbPlugin, TrampolinePipeline } from 'routier-core';
import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines, SaveChangesContextStepOne } from './types';

/**
 * The main Routier class, providing collection management, change tracking, and persistence for entities.
 *
 * @implements Disposable
 */
export class Routier implements Disposable {

    /** The underlying database plugin used for persistence. */
    protected readonly dbPlugin: IDbPlugin;
    /** Map of schema key to collection instances. */
    protected readonly collections: Map<number, Collection<any>>;
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
        this.collections = new Map<number, Collection<any>>();
        this.collectionPipelines = {
            save: new TrampolinePipeline<SaveChangesContextStepOne>(),
            hasChanges: new TrampolinePipeline<{ hasChanges: boolean }>()
        };
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (collection: Collection<TEntity>) => {
            this.collections.set(schema.key, collection)
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
        const response = {
            count: 0,
            allSchemas: this.getAllSchemas.bind(this)
        };
        this.collectionPipelines.save.filter<SaveChangesContextStepOne>(response, (result, error) => {
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
     * Previews changes (not yet implemented).
     */
    previewChanges() {

    }

    /**
     * Checks if there are any unsaved changes in the collections.
     * @param done Callback with the result (true if there are changes) or an error.
     */
    hasChanges(done: (result: boolean, error?: any) => void) {
        const payload = {
            hasChanges: false
        }
        this.collectionPipelines.hasChanges.filter<{ hasChanges: false }>(payload, (r, e) => {
            done(r.hasChanges, e);
        })
    }

    /**
     * Checks asynchronously if there are any unsaved changes in the collections.
     * @returns A promise resolving to true if there are changes, false otherwise.
     */
    hasChangesAsync() {
        return new Promise<boolean>((resolve, reject) => {
            this.hasChanges((r, e) => {
                if (e != null) {
                    reject(e);
                    return;
                }
                resolve(r);
            })
        });
    }

    /**
     * Destroys the Routier instance and underlying database plugin.
     * @param done Callback with an optional error.
     */
    destroy(done: (error?: any) => void) {
        this.dbPlugin.destroy(done);
    }

    /**
     * Destroys the Routier instance and underlying database plugin asynchronously.
     * @returns A promise that resolves when destruction is complete.
     */
    destroyAsync() {
        return new Promise<void>((resolve, reject) => {
            this.destroy((e) => {
                if (e != null) {
                    reject(e);
                    return;
                }
                resolve();
            })
        });
    }

    /**
     * Disposes the Routier instance, aborting any ongoing operations and subscriptions.
     */
    [Symbol.dispose]() {
        this.abortController.abort("Routier disposed");
    }
}