import { InferType } from '@routier/core/schema';
import { CollectionBase } from '../collections/CollectionBase';
import { View } from '../views/View';
import { Derive } from '../views/types';
import { ViewInstanceCreator } from './types';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';
import { CollectionDependencies } from '../collections/types';

type ViewBuilderProps<TEntity extends {}, TCollection extends View<TEntity>> = {
    onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    dependencies: CollectionDependencies<TEntity>;
    derive?: Derive<TEntity>;
}

type ConfiguredViewBuilderProps<TEntity extends {}, TCollection extends View<TEntity>> =
    ViewBuilderProps<TEntity, TCollection> & { accumulates: boolean };

/** Adds a scope to the dependencies. Shared by both builder stages — a scope is mode-independent. */
function addScope<TEntity extends {}, P extends {}>(
    dependencies: CollectionDependencies<TEntity>,
    selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>,
    params?: P
) {
    const expression = toExpression(dependencies.schema, selector, params);

    dependencies.scopedQueryOptions.add("filter", { filter: selector as Filter<TEntity> | ParamsFilter<TEntity, {}>, expression, params });
}

/**
 * The entry builder for a view. It has NO \`create()\` — how the view tracks its derivation must
 * be chosen first, and there is deliberately no default.
 *
 * The two are opposites, and picking the wrong one silently destroys data in one direction or
 * silently accumulates it in the other:
 *
 *  - \`mirror()\` — the view EQUALS its derivation. A row the derivation stops producing is
 *    removed. This is what makes a view usable as a synced subset: one user's data out of a
 *    table with hundreds of thousands of rows. A view that could be joined but never left would
 *    grow towards the full table, which is the cost it exists to avoid.
 *
 *  - \`accumulate()\` — the view keeps every row the derivation has ever produced. Give the
 *    schema a key derived from the row's CONTENT — a hash — and each distinct version lands as
 *    its own row, making the view an append-only history of what the derivation saw. That only
 *    works because nothing is removed.
 *
 * Neither can be inferred from the schema. A content-hash key hints at a history, but a schema
 * is free to have one and still want a mirror, so the choice is stated rather than guessed —
 * the same reason a collection has no default change-tracking mode.
 */
export class ViewBuilder<TEntity extends {}, TCollection extends View<TEntity>> {

    private readonly _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private readonly _instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    private readonly dependencies: CollectionDependencies<TEntity>;
    private _derive: Derive<TEntity> = () => void (0);

    constructor(props: ViewBuilderProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._derive = props.derive;
        this._onCollectionCreated = props.onCollectionCreated;
        this._instanceCreator = props.instanceCreator;
    }

    private configure(accumulates: boolean) {
        // The caller's instance creator, not `View` — a store may extend it, and hardcoding
        // the base class here would silently discard the subclass.
        return new ConfiguredViewBuilder<TEntity, TCollection>({
            derive: this._derive,
            accumulates,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: this._instanceCreator,
            dependencies: this.dependencies
        });
    }

    /**
     * The view equals its derivation: a row it stops producing is removed.
     *
     * The shape to use for a synced subset. See the class documentation.
     */
    mirror() {
        return this.configure(false);
    }

    /**
     * The view keeps every row the derivation has ever produced.
     *
     * The shape to use for a history, with a key derived from the row's content. See the class
     * documentation.
     */
    accumulate() {
        return this.configure(true);
    }

    /**
     * Apply a global filter (scope) to the view.
     *
     * Combined with every query issued against it, and ideal for stores that persist several
     * entity types in one physical table (IndexedDB, Local Storage, PouchDB). Pair it with a
     * tracked computed discriminator so queries target the correct logical collection.
     */
    scope(expression: Filter<InferType<TEntity>>): ViewBuilder<TEntity, TCollection>;
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): ViewBuilder<TEntity, TCollection>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P) {

        addScope(this.dependencies, selector, params);

        return new ViewBuilder<TEntity, View<TEntity>>({
            derive: this._derive,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: View,
            dependencies: this.dependencies
        });
    }

    /** Computes the view's contents. See `View` and `Derive`. */
    derive(derive: Derive<TEntity>) {

        this._derive = derive;

        return new ViewBuilder<TEntity, View<TEntity>>({
            derive: this._derive,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: View,
            dependencies: this.dependencies
        });
    }
}

/**
 * A view builder whose tracking mode has been chosen — the only builder with `create()`.
 */
export class ConfiguredViewBuilder<TEntity extends {}, TCollection extends View<TEntity>> {

    private readonly _onCollectionCreated: (collection: CollectionBase<TEntity>) => void;
    private readonly _instanceCreator: ViewInstanceCreator<TEntity, TCollection>;
    private readonly dependencies: CollectionDependencies<TEntity>;
    private readonly _accumulates: boolean;
    private _derive: Derive<TEntity> = () => void (0);

    constructor(props: ConfiguredViewBuilderProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._derive = props.derive;
        this._accumulates = props.accumulates;
        this._onCollectionCreated = props.onCollectionCreated;
        this._instanceCreator = props.instanceCreator;
    }

    private rebuild() {
        return new ConfiguredViewBuilder<TEntity, View<TEntity>>({
            derive: this._derive,
            accumulates: this._accumulates,
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: View,
            dependencies: this.dependencies
        });
    }

    /**
     * Apply a global filter (scope) to the view.
     *
     * Combined with every query issued against it, and ideal for stores that persist several
     * entity types in one physical table (IndexedDB, Local Storage, PouchDB). Pair it with a
     * tracked computed discriminator so queries target the correct logical collection.
     */
    scope(expression: Filter<InferType<TEntity>>): ConfiguredViewBuilder<TEntity, View<TEntity>>;
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): ConfiguredViewBuilder<TEntity, View<TEntity>>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P) {

        addScope(this.dependencies, selector, params);

        return this.rebuild();
    }

    /** Computes the view's contents. See `View` and `Derive`. */
    derive(derive: Derive<TEntity>) {

        this._derive = derive;

        return this.rebuild();
    }

    create(): TCollection;
    create<TExtension extends TCollection>(extend: (i: ViewInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>) => TExtension): TExtension;
    create<TExtension extends TCollection = never>(extend?: (i: ViewInstanceCreator<TEntity, TCollection>, dependencies: CollectionDependencies<TEntity>, derive: Derive<TEntity>) => TExtension) {

        if (extend == null) {
            const Instance = this._instanceCreator;
            const result = new Instance(this.dependencies, this._derive, this._accumulates);

            this._onCollectionCreated(result);

            return result;
        }

        const Instance = this._instanceCreator;
        const extendedResult = extend(Instance, this.dependencies, this._derive);

        this._onCollectionCreated(extendedResult);

        return extendedResult;
    }
}
