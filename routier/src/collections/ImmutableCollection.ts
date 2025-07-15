import { CollectionOptions, CollectionPipelines } from "../types";
import { RemovableCollection } from './RemovableCollection';
import { CompiledSchema, SchemaId, IDbPlugin, InferType, InferCreateType, CallbackResult, Result, Query } from "routier-core";

export class ImmutableCollection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: Map<SchemaId, CompiledSchema<TEntity>>
    ) {
        super(dbPlugin, schema, options, pipelines, schemas);
    }

    mutate() {

    }

    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
        const tag = this.tags.get();
        this.tags.destroy();
        this.changeTracker.add(entities, tag, done);
    }

    /**
     * Adds entities to the collection asynchronously and returns a Promise.
     * @param entities Entities to add to the collection
     * @returns Promise that resolves with the added entities or rejects with an error
     */
    addAsync(...entities: InferCreateType<TEntity>[]) {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => this.add(entities, (r) => Result.resolve(r, resolve, reject)));
    }

    /**
     * Removes entities from the collection and persists the changes to the database.
     * @param entities Array of entities to remove from the collection
     * @param done Callback function called with the removed entities or error
     */
    remove(entities: InferType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
        const tag = this.tags.get();
        this.tags.destroy();
        this.changeTracker.remove(entities, tag, done);
    }

    /**
     * Removes entities from the collection asynchronously and returns a Promise.
     * @param entities Entities to remove from the collection
     * @returns Promise that resolves with the removed entities or rejects with an error
     */
    removeAsync(...entities: InferType<TEntity>[]) {
        return new Promise<InferType<TEntity>[]>((resolve, reject) => {
            this.remove(entities, (r) => Result.resolve(r, resolve, reject));
        });
    }

    /**
     * Removes all entities from the collection and persists the changes to the database.
     * @param done Callback function called when the operation completes or with an error
     */
    removeAll(done: (error?: any) => void) {
        const tag = this.tags.get();
        this.tags.destroy();
        this.changeTracker.removeByQuery(Query.EMPTY<TEntity, TEntity>(this.schema), tag, done);
    }

    /**
     * Removes all entities from the collection asynchronously and returns a Promise.
     * @returns Promise that resolves when the operation completes or rejects with an error
     */
    removeAllAsync() {
        return new Promise<void>((resolve, reject) => this.removeAll((r) => Result.resolve(r, resolve, reject)));
    }
}