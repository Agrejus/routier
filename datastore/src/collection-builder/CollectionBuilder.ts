import { InferType } from '@routier/core/schema';
import { CollectionInstanceCreator } from './types';
import { Collection } from '../collections/Collection';
import { ImmutableCollection } from '../collections/ImmutableCollection';
import { ReadonlyCollection } from '../collections/ReadonlyCollection';
import { DiffCollection } from '../collections/DiffCollection';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';
import { CollectionBase } from '../collections/CollectionBase';
import { CollectionDependencies } from '../collections/types';

type ModelessProps<TEntity extends {}> = {
    dependencies: CollectionDependencies<TEntity>;
    onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
}

type ConfiguredProps<TEntity extends {}, TCollection extends CollectionBase<TEntity>> = ModelessProps<TEntity> & {
    instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
}

/** Shared by both builder stages — a scope is mode-independent. */
function addScope<TEntity extends {}, P extends {}>(
    dependencies: CollectionDependencies<TEntity>,
    selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>,
    params?: P
) {
    const schema = dependencies.schema

    const expression = toExpression(schema, selector, params);

    dependencies.scopedQueryOptions.add("filter", { filter: selector as Filter<TEntity> | ParamsFilter<TEntity, {}>, expression, params });
}

/**
 * The entry builder for a collection. It has NO `create()` — a change-tracking mode must
 * be chosen first, and there is deliberately no default: how mutations are detected is the
 * most consequential fact about a collection, so every declaration states it, and wrong
 * code does not compile.
 *
 *  - `proxy()`     — entities are wrapped in a tracking Proxy; every write is recorded as
 *                    it happens. Precise per-property deltas; per-write overhead; proxies
 *                    cannot cross structured-clone boundaries.
 *  - `diff()`      — entities are plain objects and the store's memory holds the canonical
 *                    instances: a reference you hold IS the store's instance. Saves detect
 *                    mutations by comparing a content-hash snapshot taken at attach time.
 *                    No proxies anywhere; changed entities are written whole.
 *  - `immutable()` — reads are frozen; changes go through `update()` patches producing new
 *                    instances. A plain mutation throws instead of being silently lost.
 *  - `readonly()`  — data can only be read.
 */
export class CollectionBuilder<TEntity extends {}> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private dependencies: CollectionDependencies<TEntity>;

    constructor(props: ModelessProps<TEntity>) {
        this.dependencies = props.dependencies;
        this._onCollectionCreated = props.onCollectionCreated;
    }

    private configure<TCollection extends CollectionBase<TEntity>>(instanceCreator: CollectionInstanceCreator<TEntity, TCollection>) {
        return new ConfiguredCollectionBuilder<TEntity, TCollection>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator,
            dependencies: this.dependencies
        });
    }

    /** Live change tracking through a Proxy: every write is recorded as it happens. */
    proxy() {
        return this.configure<Collection<TEntity>>(Collection);
    }

    /**
     * Snapshot change tracking: entities are plain objects, the reference you hold is the
     * store's canonical instance, and saves detect changes by comparing against a
     * content-hash baseline taken when the entity was attached.
     */
    diff() {
        return this.configure<DiffCollection<TEntity>>(DiffCollection);
    }

    /** Frozen reads; changes go through `update()` patches producing new instances. */
    immutable() {
        return this.configure<ImmutableCollection<TEntity>>(ImmutableCollection);
    }

    /** Data can only be read. */
    readonly() {
        return this.configure<ReadonlyCollection<TEntity>>(ReadonlyCollection);
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
     *   .proxy()
     *   .create();
     *
     * @param expression A filter expression that will be AND-ed with all user queries
     * @returns A builder for chaining additional configuration
     */
    scope(expression: Filter<InferType<TEntity>>): CollectionBuilder<TEntity>;
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
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): CollectionBuilder<TEntity>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P): CollectionBuilder<TEntity> {

        addScope(this.dependencies, selector, params);

        return new CollectionBuilder<TEntity>({
            onCollectionCreated: this._onCollectionCreated,
            dependencies: this.dependencies
        });
    }
}

/**
 * A collection builder whose change-tracking mode has been chosen — the only builder with
 * `create()`.
 */
export class ConfiguredCollectionBuilder<TEntity extends {}, TCollection extends CollectionBase<TEntity>> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    private dependencies: CollectionDependencies<TEntity>;

    constructor(props: ConfiguredProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._onCollectionCreated = props.onCollectionCreated;
        this.instanceCreator = props.instanceCreator;
    }

    /** See CollectionBuilder.scope — a scope may also be added after the mode is chosen. */
    scope(expression: Filter<InferType<TEntity>>): ConfiguredCollectionBuilder<TEntity, TCollection>;
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): ConfiguredCollectionBuilder<TEntity, TCollection>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P): ConfiguredCollectionBuilder<TEntity, TCollection> {

        addScope(this.dependencies, selector, params);

        return new ConfiguredCollectionBuilder<TEntity, TCollection>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: this.instanceCreator,
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
