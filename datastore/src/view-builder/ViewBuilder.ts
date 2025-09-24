import { CompiledSchema, InferCreateType, InferType, SchemaId } from '@routier/core/schema';
import { CollectionOptions, CollectionPipelines } from '../types';
import { IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { CollectionBase } from '../collections/CollectionBase';
import { View } from '../views/View';
import { ViewInstanceCreator } from './types';
import { SchemaCollection } from '@routier/core/collections';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';

type CollectionBuilderProps<TEntity extends {}, TCollection extends View<TEntity>> = {
    onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    schema: CompiledSchema<TEntity>;
    dbPlugin: IDbPlugin;
    instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    pipelines: CollectionPipelines;
    signal: AbortSignal;
    scopedQueryOptions?: QueryOptionsCollection<InferType<TEntity>>;
    schemas: SchemaCollection;
    deriveCallback: (callback: DeriveCallback<TEntity>) => void;
    persistCallback: IDbPlugin["bulkPersist"];
}

export type DeriveCallback<TEntity extends {}> = (viewData: InferCreateType<TEntity>[]) => void;

export class ViewBuilder<TEntity extends {}, TCollection extends View<TEntity>> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private readonly _schema: CompiledSchema<TEntity>;
    private readonly _dbPlugin: IDbPlugin;
    private _instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    private _pipelines: CollectionPipelines;
    private _signal: AbortSignal;
    private schemas: SchemaCollection;
    private scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>;
    private deriveCallback: (callback: DeriveCallback<TEntity>) => void;
    private persistCallback: IDbPlugin["bulkPersist"];

    constructor(props: CollectionBuilderProps<TEntity, TCollection>) {
        this.deriveCallback = props.deriveCallback;
        this._pipelines = props.pipelines;
        this._schema = props.schema;
        this._dbPlugin = props.dbPlugin;
        this._onCollectionCreated = props.onCollectionCreated;
        this.persistCallback = props.persistCallback;
        this._instanceCreator = props.instanceCreator;
        this._signal = props.signal;
        this.schemas = props.schemas;
        this.scopedQueryOptions = props.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>();
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
    scope(expression: Filter<InferType<TEntity>>): ViewBuilder<TEntity, TCollection>;
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
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): ViewBuilder<TEntity, TCollection>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P) {

        const expression = toExpression(this._schema, selector, params);

        this.scopedQueryOptions.add("filter", { filter: selector as Filter<InferType<TEntity>> | ParamsFilter<InferType<TEntity>, {}>, expression, params });

        return new ViewBuilder<TEntity, View<TEntity>>({
            dbPlugin: this._dbPlugin,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: View,
            persistCallback: this.persistCallback,
            pipelines: this._pipelines,
            signal: this._signal,
            schemas: this.schemas,
            scopedQueryOptions: this.scopedQueryOptions,
            deriveCallback: this.deriveCallback
        });
    }

    derive(done: (callback: DeriveCallback<TEntity>) => void) {

        this.deriveCallback = done;

        return new ViewBuilder<TEntity, View<TEntity>>({
            dbPlugin: this._dbPlugin,
            onCollectionCreated: this._onCollectionCreated,
            schema: this._schema,
            instanceCreator: View,
            persistCallback: this.persistCallback,
            pipelines: this._pipelines,
            signal: this._signal,
            schemas: this.schemas,
            scopedQueryOptions: this.scopedQueryOptions,
            deriveCallback: this.deriveCallback
        });
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: ViewInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, schemas: Map<SchemaId, CompiledSchema<any>>, scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>, derive: (callback: DeriveCallback<TEntity>) => void) => TExtension, persist: IDbPlugin["bulkPersist"]): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: ViewInstanceCreator<TEntity, TCollection>, dbPlugin: IDbPlugin, schema: CompiledSchema<TEntity>, options: CollectionOptions, pipelines: CollectionPipelines, schemas: Map<SchemaId, CompiledSchema<any>>, scopedQueryOptions: QueryOptionsCollection<InferType<TEntity>>, derive: (callback: DeriveCallback<TEntity>) => void, persist: IDbPlugin["bulkPersist"]) => TExtension) {

        const options: CollectionOptions = {
            signal: this._signal,
        }

        if (extend == null) {
            const Instance = this._instanceCreator;
            const result = new Instance(this._dbPlugin, this._schema, options, this._pipelines, this.schemas, this.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>(), this.deriveCallback, this.persistCallback);

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this._instanceCreator;
        const extendedResult = extend(Instance, this._dbPlugin, this._schema, options, this._pipelines, this.schemas, this.scopedQueryOptions ?? new QueryOptionsCollection<InferType<TEntity>>(), this.deriveCallback, this.persistCallback);

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}