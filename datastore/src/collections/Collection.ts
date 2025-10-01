import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { CollectionOptions, CollectionPipelines } from "../types";
import { RemovableCollection } from './RemovableCollection';
import { CompiledSchema, InferCreateType, InferType } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { SchemaCollection } from "@routier/core/collections";
import { GenericFunction } from "@routier/core/types";

export class Collection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: SchemaCollection,
        queryOptions: QueryOptionsCollection<InferType<TEntity>>
    ) {
        super(dbPlugin, schema, options, pipelines, schemas, queryOptions);

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
            return this.changeTracker.tags.get()
        },
        destroy: () => {
            return this.changeTracker.tags.destroy()
        }
    }

    // This is a mediator so we can access underlying attached entities
    attachments = {
        /** Detaches entities from change tracking, removing them from the collection's managed set */
        remove: (...entities: InferType<TEntity>[]) => {
            return this.changeTracker.detach(entities);
        },
        /** Attaches entities to change tracking, enabling property change monitoring and dirty state management */
        set: (...entities: InferType<TEntity>[]) => {
            const tag = this.getAndDestroyTag()
            return this.changeTracker.resolve(entities, tag, { merge: true });
        },
        /** Checks if an entity is currently attached to change tracking */
        has: (entity: InferType<TEntity>) => {
            return this.changeTracker.isAttached(entity);
        },
        /** Retrieves an attached entity from change tracking if it exists */
        get: (entity: InferType<TEntity>) => {
            const found = this.changeTracker.getAttached(entity);

            return found?.doc;
        },
        /** Filters attached entities using a selector function, returning entities that match the criteria */
        filter: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.changeTracker.filterAttached(selector);
        },

        /** Finds attached entity using a selector function, returning first entity that matches the criteria */
        find: (selector: GenericFunction<InferType<TEntity>, boolean>) => {
            return this.changeTracker.findAttached(selector);
        },

        /** Marks entities as dirty, forcing them to be included in the next save operation regardless of actual property changes */
        markDirty: (...entities: InferType<TEntity>[]) => {
            return this.changeTracker.markDirty(entities);
        },
        /** Retrieves the change type for a specific entity. Returns the change type if attached, or undefined if not attached. */
        getChangeType: (entity: InferType<TEntity>) => {
            const found = this.changeTracker.getAttached(entity);

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
     * Sets a tag for the next operation. The tag will be used to group related operations.
     * @param tag The tag to associate with the next operation
     * @returns The collection instance for method chaining
     */
    tag(tag: unknown) {
        this._tag = tag;
        return this;
    }
}