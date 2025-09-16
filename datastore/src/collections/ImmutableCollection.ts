import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { CollectionOptions, CollectionPipelines } from "../types";
import { RemovableCollection } from './RemovableCollection';
import { ChangeTrackingType, CompiledSchema, InferType } from "@routier/core/schema";
import { SchemaCollection } from "@routier/core/collections";

export class ImmutableCollection<TEntity extends {}> extends RemovableCollection<TEntity> {

    constructor(
        dbPlugin: IDbPlugin,
        schema: CompiledSchema<TEntity>,
        options: CollectionOptions,
        pipelines: CollectionPipelines,
        schemas: SchemaCollection,
        queryOptions: QueryOptionsCollection<InferType<TEntity>>
    ) {
        super(dbPlugin, schema, options, pipelines, schemas, queryOptions);

        this.mutate = this.mutate.bind(this);
    }

    mutate() {

    }

    protected override get changeTrackingType(): ChangeTrackingType {
        return "immutable";
    }
}