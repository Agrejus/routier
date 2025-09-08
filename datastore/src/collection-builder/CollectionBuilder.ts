import { CompiledSchema, InferType, SchemaId } from '@routier/core/schema';
import { Collection } from '../collections/Collection';
import { CollectionOptions, CollectionPipelines } from '../types';
import { CollectionInstanceCreator } from './types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { ImmutableCollection } from '../collections/ImmutableCollection';
import { DiffCollection } from '../collections/DiffCollection';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';

type CollectionBuilderProps<TEntity extends {}, TCollecition extends Collection<TEntity>> = {
    onCollectionCreated: (collection: Collection<TEntity>) => void;
    schema: CompiledSchema<TEntity>;
    dbPlugin: IDbPlugin;
    instanceCreator: CollectionInstanceCreator<TEntity, TCollecition>;
    pipelines: CollectionPipelines;
    signal: AbortSignal;
    scopedQueryOptions?: QueryOptionsCollection<InferType<TEntity>>;
    schemas: Map<SchemaId, CompiledSchema<any>>;
}
export class CollectionBuilder<TEntity extends {}, TCollection extends Collection<TEntity>> {

    private _onCollectionCreated: (collection: Collection<TEntity>) => void;
    private readonly _schema: CompiledSchema<TEntity>;
    private readonly _dbPlugin: IDbPlugin;
    private _instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    private _pipelines: CollectionPipelines;
    private _signal: AbortSignal;
    private schemas: Map<SchemaId, CompiledSchema<any>>;
    private scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>;

    constructor(props: CollectionBuilderProps<TEntity, TCollection>) {
        this._pipelines = props.pipelines;
        this._schema = props.schema;
        this._dbPlugin = props.dbPlugin;
        this._onCollectionCreated = props.onCollectionCreated;
        this._instanceCreator = props.instanceCreator;
        this._signal = props.signal;
        this.schemas = props.schemas;
        this.scopedQueryOptions = props.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>();
    }

    immutable() {
        return new CollectionBuilder<TEntity, ImmutableCollection<TEntity>>({
            dbPlugin: this._dbPlugin,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: ImmutableCollection,
            pipelines: this._pipelines,
            signal: this._signal,
            schemas: this.schemas,
            scopedQueryOptions: this.scopedQueryOptions
        });
    }

    diff() {
        return new CollectionBuilder<TEntity, DiffCollection<TEntity>>({
            dbPlugin: this._dbPlugin,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: DiffCollection,
            pipelines: this._pipelines,
            signal: this._signal,
            schemas: this.schemas,
            scopedQueryOptions: this.scopedQueryOptions
        });
    }

    /**
     * Apply a global filter (scope) to the collection.
     *
     * The scope is combined with every query issued against this collection and is ideal for
     * stores that persist multiple entity types in a single physical table/collection
     * (e.g. IndexedDB, Local Storage, PouchDB). Pair this with a tracked computed
     * discriminator (for example, `collectionName`) to ensure all queries target the
     * correct logical collection and avoid cross‑type collisions.
     *
     * Example:
     * comments = this.collection(commentSchema)
     *   .scope((e, { collectionName }) => e.collectionName === collectionName)
     *   .create();
     *
     * @param expression A filter expression that will be AND-ed with all user queries
     * @returns A builder for chaining additional configuration
     */
    scope(expression: Filter<InferType<TEntity>>): CollectionBuilder<TEntity, TCollection>;
    /**
     * Apply a global, parameterized filter (scope) to the collection.
     *
     * This overload accepts parameters for the scope expression. The scope is AND‑ed
     * with all user queries and is typically used with a tracked computed
     * discriminator (e.g., `collectionName`) when multiple entity types share one
     * physical table/collection. The `collectionName` parameter is automatically
     * injected from the collection context; you do not need to supply it.
     *
     * @param selector Parameterized filter function used as the global scope
     * @param params Parameters passed to the selector (excluding `collectionName`, which is auto‑injected)
     * @returns A builder for chaining additional configuration
     */
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): CollectionBuilder<TEntity, TCollection>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P): CollectionBuilder<TEntity, TCollection> {

        const expression = toExpression(this._schema, selector, params);

        this.scopedQueryOptions.add("filter", { filter: selector as Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, {}>, expression, params });

        return new CollectionBuilder<TEntity, TCollection>({
            dbPlugin: this._dbPlugin,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: this._instanceCreator,
            pipelines: this._pipelines,
            signal: this._signal,
            schemas: this.schemas,
            scopedQueryOptions: this.scopedQueryOptions
        });
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: CollectionInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, schemas: Map<SchemaId, CompiledSchema<any>>, scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>) => TExtension): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: CollectionInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, schemas: Map<SchemaId, CompiledSchema<any>>, scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>) => TExtension) {

        const options: CollectionOptions = {
            signal: this._signal,
        }

        if (extend == null) {
            const Instance = this._instanceCreator;
            const result = new Instance(this._dbPlugin, this._schema, options, this._pipelines, this.schemas, this.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>());

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this._instanceCreator;
        const extendedResult = extend(Instance, this._dbPlugin, this._schema, options, this._pipelines, this.schemas, this.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>());

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}