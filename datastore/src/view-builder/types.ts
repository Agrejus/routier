import { CompiledSchema, InferType } from "@routier/core/schema";
import { CollectionOptions, CollectionPipelines } from "../types";
import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { View } from "../views/View";
import { SchemaCollection } from "@routier/core/collections";
import { DeriveCallback } from "./ViewBuilder";

export type ViewInstanceCreator<
    TEntity extends {},
    TCollection extends View<TEntity>
> = new (
    dbPlugin: IDbPlugin,
    schema: CompiledSchema<TEntity>,
    options: CollectionOptions,
    pipelines: CollectionPipelines,
    schemas: SchemaCollection,
    queryOptions: QueryOptionsCollection<InferType<TEntity>>,
    derive: (callback: DeriveCallback<TEntity>) => void
) => TCollection;