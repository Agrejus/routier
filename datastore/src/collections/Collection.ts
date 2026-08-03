import { RemovableCollection } from './RemovableCollection';
import { InferCreateType, InferType } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { GenericFunction } from "@routier/core/types";
import { CollectionDependencies } from "./types";

export class Collection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        dependencies: CollectionDependencies<TEntity>
    ) {
        super(dependencies);

        // Bind all methods in tags object
        this.tags.get = this.tags.get.bind(this);
        this.tags.destroy = this.tags.destroy.bind(this);

        // Bind all public methods to ensure 'this' context is preserved
        this.add = this.add.bind(this);
        this.addAsync = this.addAsync.bind(this);
        this.tag = this.tag.bind(this);

        // Bind all methods in attachments object
        this.attachments.remove = this.attachments.remove.bind(this);
        this.attachments.set = this.attachments.set.bind(this);
        this.attachments.has = this.attachments.has.bind(this);
        this.attachments.get = this.attachments.get.bind(this);
        this.attachments.filter = this.attachments.filter.bind(this);
        this.attachments.find = this.attachments.find.bind(this);
        this.attachments.markDirty = this.attachments.markDirty.bind(this);
        this.attachments.getChangeType = this.attachments.getChangeType.bind(this);
    }

    tags = {
        get: () => {
            return this.dependencies.changeTracker.tags.get()
        },
        destroy: () => {
            return this.dependencies.changeTracker.tags.destroy()
        }
    }

    // This is a mediator so we can access underlying attached entities
    attachments = {
        /** Detaches entities from change tracking, removing them from the collection's managed set */
        remove: (...entities: InferType<TEntity>[]) => {
            return this.dependencies.changeTracker.detach(entities);
        },
        /**
         * Attaches entities to change tracking, enabling property change monitoring and
         * dirty state management. The given instances become the canonical attachments —
         * an explicit set means the caller will mutate THESE instances, so a previously
         * attached copy of the same entity (e.g. via a background query) is merged into
         * them and replaced rather than kept.
         */
        set: (...entities: InferType<TEntity>[]) => {
            const tag = this.getAndDestroyTag()
            return this.dependencies.changeTracker.resolveMany(entities, tag, { merge: true, adopt: true });
        },
        /** Checks if an entity is currently attached to change tracking */
        has: (entity: InferType<TEntity>) => {
            return this.dependencies.changeTracker.isAttached(entity);
        },
        /** Retrieves an attached entity from change tracking if it exists */
        get: (entity: InferType<TEntity>) => {
            const found = this.dependencies.changeTracker.getAttached(entity);

            return found?.doc;
        },
        /** Filters attached entities using a selector function, returning entities that match the criteria */
        filter: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.dependencies.changeTracker.filterAttached(selector);
        },

        /** Finds attached entity using a selector function, returning first entity that matches the criteria */
        find: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.dependencies.changeTracker.findAttached(selector);
        },

        /** Marks entities as dirty, forcing them to be included in the next save operation regardless of actual property changes */
        markDirty: (...entities: InferType<TEntity>[]) => {
            return this.dependencies.changeTracker.markDirty(entities);
        },
        /** Retrieves the change type for a specific entity. Returns the change type if attached, or undefined if not attached. */
        getChangeType: (entity: InferType<TEntity>) => {
            const found = this.dependencies.changeTracker.getAttached(entity);

            if (found == null) {
                return undefined
            }

            return found.changeType;
        }
    }

    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: CallbackResult<InferType<TEntity>[]>) {
        const tag = this.getAndDestroyTag();
        this.dependencies.changeTracker.add(entities, tag, done);
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
     * Applies a patch — or an updater function — to a row, returning the new value.
     *
     * SPIKE (specs/immutable-updates.md). The immutable alternative to mutating a
     * change-tracked proxy. Two things make it different from `entity.price = 9`:
     *
     * 1. **It returns the new value; it does not modify the one you passed.**
     * 2. **Your reference only has to identify the row, not be current.** The patch is
     *    applied to whatever the collection holds now, so handing it a stale entity is
     *    safe — which is the failure mode that actually loses data. It also makes
     *    read-modify-write correct, because the updater receives the current value:
     *
     * ```ts
     * // +2, as intended. With a stale `prev` captured by the caller this would be +1.
     * store.products.update(p, prev => ({ ...prev, price: prev.price + 1 }));
     * store.products.update(p, prev => ({ ...prev, price: prev.price + 1 }));
     * ```
     *
     * Arrays and Dates are values: a patch replaces them rather than merging into them.
     * That is deliberate — element-wise array merging makes "drop the last tag"
     * inexpressible, and it is the ambiguity that made in-place array mutation unreliable
     * under proxies (defect #12).
     *
     * @param entity Any generation of the row. Only its id is read.
     * @param recipe A partial entity to merge, or `current => next`.
     */
    update(entity: InferType<TEntity>, recipe: Record<string, any> | ((current: InferType<TEntity>) => InferType<TEntity>)) {
        return this.dependencies.changeTracker.updateImmutable(entity, recipe);
    }

    /**
     * The current value of a row, given any generation of it.
     *
     * The escape hatch for imperative code holding a reference across updates. Component
     * code should not need it — subscriptions hand out fresh values on every change.
     */
    current(entity: InferType<TEntity>) {
        return this.dependencies.changeTracker.currentOf(entity);
    }

    /** Whether the given reference is the row's current value. */
    isCurrent(entity: InferType<TEntity>) {
        return this.current(entity) === entity;
    }

    /**
     * Sets a tag for the next operation. The tag will be used to group related operations.
     * @param tag The tag to associate with the next operation
     * @returns The collection instance for method chaining
     */
    tag(tag: unknown) {
        this._tag = tag;
        return this;
    }
}