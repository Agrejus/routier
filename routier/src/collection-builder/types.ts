import { CompiledSchema, IDbPlugin, SchemaParent } from "routier-core";
import { Collection } from "../collections/Collection";
import { CollectionOptions, CollectionPipelines } from "../types";

export type CollectionInstanceCreator<TEntity extends {}, TCollection extends Collection<TEntity>> = new (dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, parent: SchemaParent) => TCollection;