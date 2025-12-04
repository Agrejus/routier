import { InferType } from '@routier/core/schema';
import { CollectionBase } from '../collections/CollectionBase';
import { View } from '../views/View';
import { Derive } from '../views/types';
import { ViewInstanceCreator } from './types';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';
import { CollectionDependencies } from '../collections/types';

type CollectionBuilderProps<TEntity extends {}, TCollection extends View<TEntity>> = {
    onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    dependencies: CollectionDependencies<TEntity>;
    derive?: Derive<TEntity>;
}

export class ViewBuilder<TEntity extends {}, TCollection extends View<TEntity>> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private _instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    private dependencies: CollectionDependencies<TEntity>;
    private _derive: Derive<TEntity> = () => void (0);

    constructor(props: CollectionBuilderProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._derive = props.derive;
        this._onCollectionCreated = props.onCollectionCreated;
        this._instanceCreator = props.instanceCreator;
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

        const schema = this.dependencies.schema;
        const expression = toExpression(schema, selector, params);

        this.dependencies.scopedQueryOptions.add("filter", { filter: selector as Filter<TEntity> | ParamsFilter<TEntity, {}>, expression, params });

        return new ViewBuilder<TEntity, View<TEntity>>({
            derive: this._derive,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: View,
            dependencies: this.dependencies
        });
    }

    derive(derive: Derive<TEntity>) {

        this._derive = derive;

        return new ViewBuilder<TEntity, View<TEntity>>({
            derive: this._derive,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: View,
            dependencies: this.dependencies
        });
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: ViewInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>) => TExtension): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: ViewInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>) => TExtension) {


        if (extend == null) {
            const Instance = this._instanceCreator;
            const result = new Instance(this.dependencies, this._derive);

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this._instanceCreator;
        const extendedResult = extend(Instance, this.dependencies, this._derive);

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}