import { InferType } from '@routier/core/schema';
import { CollectionInstanceCreator } from './types';
import { ImmutableCollection } from '../collections/ImmutableCollection';
import { ReadonlyCollection } from '../collections/ReadonlyCollection';
import { DiffCollection } from '../collections/DiffCollection';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';
import { CollectionBase } from '../collections/CollectionBase';
import { CollectionDependencies } from '../collections/types';

type CollectionBuilderProps<TEntity extends {}, TCollection extends CollectionBase<TEntity>> = {
    dependencies: CollectionDependencies<TEntity>;
    instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
}
export class CollectionBuilder<TEntity extends {}, TCollection extends CollectionBase<TEntity>> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    private dependencies: CollectionDependencies<TEntity>;

    constructor(props: CollectionBuilderProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._onCollectionCreated = props.onCollectionCreated;
        this.instanceCreator = props.instanceCreator;
    }

    immutable() {
        return new CollectionBuilder<TEntity, ImmutableCollection<TEntity>>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: ImmutableCollection,
            dependencies: this.dependencies
        });
    }

    diff() {
        return new CollectionBuilder<TEntity, DiffCollection<TEntity>>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: DiffCollection,
            dependencies: this.dependencies
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

        const schema = this.dependencies.schema

        const expression = toExpression(schema, selector, params);

        this.dependencies.scopedQueryOptions.add("filter", { filter: selector as Filter<TEntity> | ParamsFilter<TEntity, {}>, expression, params });

        return new CollectionBuilder<TEntity, TCollection>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: this.instanceCreator,
            dependencies: this.dependencies
        });
    }

    readonly() {
        return new CollectionBuilder<TEntity, ReadonlyCollection<TEntity>>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: ReadonlyCollection,
            dependencies: this.dependencies
        });
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: CollectionInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>) => TExtension): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: CollectionInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>) => TExtension) {

        if (extend == null) {
            const Instance = this.instanceCreator;
            const result = new Instance(this.dependencies);

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this.instanceCreator;
        const extendedResult = extend(Instance, this.dependencies);

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}