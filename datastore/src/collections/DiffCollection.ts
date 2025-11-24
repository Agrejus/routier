import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { CollectionOptions, CollectionPipelines } from "../types";
import { Collection } from './Collection';
import { ChangeTrackingType, CompiledSchema, InferCreateType, InferType } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";
import { CallbackResult, Result } from "@routier/core/results";
import { GenericFunction } from "@routier/core/types";

export class DiffCollection<TEntity extends {}> extends Collection<TEntity> {

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

    protected override get changeTrackingType(): ChangeTrackingType {
        return "diff";
    }


    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: CallbackResult<InferCreateType<TEntity>[]>) {
        try {
            const tag = this.getAndDestroyTag();
            const result = this.addChangeTracker.trackMany(entities, tag);

            done(Result.success(result));
        } catch (e) {
            done(Result.error(e));
        }
    }

    /**
     * Adds entities to the collection asynchronously and returns a Promise.
     * @param entities Entities to add to the collection
     * @returns Promise that resolves with the added entities or rejects with an error
     */
    addAsync(...entities: InferCreateType<TEntity>[]) {
        return new Promise<InferCreateType<TEntity>[]>((resolve, reject) => this.add(entities, (r) => Result.resolve(r, resolve, reject)));
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