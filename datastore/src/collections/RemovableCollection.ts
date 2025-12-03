import { CollectionBase } from './CollectionBase';
import { InferType } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { SimpleContainer } from "../ioc/SimpleContainer";
import { CollectionDependencies } from "./types";

export class RemovableCollection<TEntity extends {}> extends CollectionBase<TEntity> {

    constructor(
        container: SimpleContainer<CollectionDependencies<TEntity>>
    ) {
        super(container);

        // Bind all public methods to ensure 'this' context is preserved
        this.remove = this.remove.bind(this);
        this.removeAsync = this.removeAsync.bind(this);
        this.removeAll = this.removeAll.bind(this);
        this.removeAllAsync = this.removeAllAsync.bind(this);
    }

    /**
     * Removes entities from the collection and persists the changes to the database.
     * @param entities Array of entities to remove from the collection
     * @param done Callback function called with the removed entities or error
     */
    remove(entities: InferType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
        const tag = this.getAndDestroyTag();
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
        const tag = this.getAndDestroyTag();
        this.changeTracker.removeByQuery({
            changeTracking: false,
            options: this.scopedQueryOptions as any,
            schema: this.schema
        }, tag, done);
    }

    /**
     * Removes all entities from the collection asynchronously and returns a Promise.
     * @returns Promise that resolves when the operation completes or rejects with an error
     */
    removeAllAsync() {
        return new Promise<void>((resolve, reject) => this.removeAll((r) => Result.resolve(r, resolve, reject)));
    }
}