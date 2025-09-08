import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { CollectionOptions, CollectionPipelines } from "../types";
import { RemovableCollection } from './RemovableCollection';
import { CompiledSchema, InferCreateType, InferType } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { SchemaCollection } from "@routier/core/collections";

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

        // Bind all public methods to ensure 'this' context is preserved
        this.add = this.add.bind(this);
        this.addAsync = this.addAsync.bind(this);
    }

    /**
     * Adds entities to the collection and persists them to the database.
     * @param entities Array of entities to add to the collection
     * @param done Callback function called with the added entities or error
     */
    add(entities: InferCreateType<TEntity>[], done: CallbackResult<InferCreateType<TEntity>[]>) {
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
}