import { CompiledSchema, IDbPlugin, TrampolinePipeline } from 'routier-core';
import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines, SaveChangesContextStepOne } from './types';

export class Routier implements Disposable {

    private readonly dbPlugin: IDbPlugin;
    private readonly collections: Map<number, Collection<any>>;
    private readonly collectionPipelines: CollectionPipelines;
    private readonly abortController: AbortController;

    constructor(dbPlugin: IDbPlugin) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.collections = new Map<number, Collection<any>>();
        this.collectionPipelines = {
            save: new TrampolinePipeline<SaveChangesContextStepOne>(),
            hasChanges: new TrampolinePipeline<{ hasChanges: boolean }>()
        };
    }

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

    addEventListener(event: "", cb: () => void) {

    }

    private getAllSchemas(): CompiledSchema<any>[] {
        const result: CompiledSchema<any>[] = [];

        for (const [, value] of this.collections) {
            result.push(value.schema);
        }

        return result;
    }

    // Can we borrow from redux and create a way to inject middleware?
    // use actions?
    // action.type -> "SaveChanges"
    saveChanges(done: (result: number, error?: any) => void) {

        const response = {
            count: 0,
            allSchemas: this.getAllSchemas.bind(this)
        };

        this.collectionPipelines.save.filter<SaveChangesContextStepOne>(response, (result, error) => {
            done(result.count, error);
        });
    }

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

    previewChanges() {

    }

    hasChanges(done: (result: boolean, error?: any) => void) {
        const payload = {
            hasChanges: false
        }

        this.collectionPipelines.hasChanges.filter<{ hasChanges: false }>(payload, (r, e) => {
            done(r.hasChanges, e);
        })
    }

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

    destroy(done: (error?: any) => void) {
        this.dbPlugin.destroy(done);
    }

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

    [Symbol.dispose]() {
        this.abortController.abort();
    }
}


/**
 * Events
 *  Need a way to update stateful sets
 */