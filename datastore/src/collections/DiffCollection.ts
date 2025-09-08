import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { CollectionOptions, CollectionPipelines } from "../types";
import { Collection } from './Collection';
import { ChangeTrackingType, CompiledSchema, InferType } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";

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
    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "diff";
    }
}