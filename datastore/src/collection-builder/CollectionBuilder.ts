import { CompiledSchema, InferType } from '@routier/core/schema';
import { CollectionInstanceCreator } from './types';
import { Collection } from '../collections/Collection';
import { ImmutableCollection } from '../collections/ImmutableCollection';
import { ReadonlyCollection } from '../collections/ReadonlyCollection';
import { DiffCollection } from '../collections/DiffCollection';
import { Filter, ParamsFilter, toExpression } from '@routier/core/expressions';
import { GenericFunction } from '@routier/core/types';
import { CollectionBase } from '../collections/CollectionBase';
import { CollectionDependencies } from '../collections/types';
import { resolveSoftDelete, softDeleteScope } from './softDelete';
import { AuditDerive } from './audit';
import { FullTextSearchOptions, resolveFullTextSearch } from './fullTextSearch';

type ModelessProps<TEntity extends {}> = {
    dependencies: CollectionDependencies<TEntity>;
    onCollectionCreated: (collection: CollectionBase<TEntity, any>) => void;
}

type ConfiguredProps<TEntity extends {}, TCollection extends CollectionBase<TEntity, any>> = ModelessProps<TEntity> & {
    instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
}

/**
 * Shared by both builder stages — soft delete is mode-independent.
 *
 * Registers both halves at once so they cannot be enabled separately: the change tracker
 * learns to stamp instead of delete, and every query gains a scope hiding stamped rows.
 */
function addSoftDelete<TEntity extends {}>(
    dependencies: CollectionDependencies<TEntity>,
    selector: GenericFunction<InferType<TEntity>, unknown>
) {
    const configuration = resolveSoftDelete(dependencies.schema, selector as GenericFunction<TEntity, unknown>);
    const { filter, expression } = softDeleteScope(configuration);

    dependencies.changeTracker.enableSoftDelete(configuration);
    dependencies.scopedQueryOptions.add("filter", { filter: filter as Filter<TEntity>, expression, params: undefined });
}

/**
 * Shared by both builder stages — full-text search is mode-independent.
 *
 * Registers the declaration and the generated index schema together. The index schema is
 * registered with the STORE here rather than waiting for maintenance to be wired, because a
 * plugin builds its table from the schema collection: a schema that arrives late is a table
 * that does not exist when the first save tries to write to it.
 */
function addFullTextSearch<TEntity extends {}>(
    dependencies: CollectionDependencies<TEntity>,
    options: FullTextSearchOptions | undefined
) {
    const registration = resolveFullTextSearch(dependencies.schema, options);

    dependencies.fullTextSearches.register(registration);
    dependencies.schemas.set(registration.indexSchema.id, registration.indexSchema);
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
 * The stage between `.audit(schema)` and `.derive(...)`.
 *
 * It exists so the declaration reads the same way a view's does: the first call names the
 * shape being written, the second decides what goes in it. Splitting them also means there is
 * no half-declared audit — this stage has no `create()`, so a collection cannot be built with
 * an audit target and no rule for filling it.
 */
export class AuditingCollectionBuilder<TEntity extends {}, TAudit extends {}, TNext> {

    constructor(
        private readonly auditSchema: CompiledSchema<TAudit>,
        private readonly dependencies: CollectionDependencies<TEntity>,
        private readonly next: () => TNext
    ) { }

    /**
     * Decides what to record, given everything that changed in one save.
     *
     * @param derive Receives the batch for this collection and a callback to emit rows with.
     * Emit none — or never call it — to record nothing.
     */
    derive(derive: AuditDerive<InferType<TEntity>, TAudit>): TNext {
        this.dependencies.audits.register({
            sourceSchemaId: this.dependencies.schema.id,
            auditSchema: this.auditSchema,
            derive: derive as AuditDerive<any, any>,
        });

        return this.next();
    }
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
export class CollectionBuilder<TEntity extends {}, TStore = unknown> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity, any>) => void;
    private dependencies: CollectionDependencies<TEntity>;

    constructor(props: ModelessProps<TEntity>) {
        this.dependencies = props.dependencies;
        this._onCollectionCreated = props.onCollectionCreated;
    }

    private configure<TCollection extends CollectionBase<TEntity, any>>(instanceCreator: CollectionInstanceCreator<TEntity, TCollection>) {
        return new ConfiguredCollectionBuilder<TEntity, TCollection, TStore>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator,
            dependencies: this.dependencies
        });
    }

    /** Live change tracking through a Proxy: every write is recorded as it happens. */
    proxy() {
        return this.configure<Collection<TEntity, TStore>>(Collection);
    }

    /**
     * Snapshot change tracking: entities are plain objects, the reference you hold is the
     * store's canonical instance, and saves detect changes by comparing against a
     * content-hash baseline taken when the entity was attached.
     */
    diff() {
        return this.configure<DiffCollection<TEntity, TStore>>(DiffCollection);
    }

    /** Frozen reads; changes go through `update()` patches producing new instances. */
    immutable() {
        return this.configure<ImmutableCollection<TEntity, TStore>>(ImmutableCollection);
    }

    /** Data can only be read. */
    readonly() {
        return this.configure<ReadonlyCollection<TEntity, TStore>>(ReadonlyCollection);
    }

    /**
     * Record what changes on this collection into a table of your own design.
     *
     * The same shape as `view().derive()`: this names where rows go, and `derive` decides what
     * they contain. Nothing about the row is decided for you.
     *
     * ```ts
     * history = this.collection(historySchema).proxy().create();
     *
     * products = this.collection(productSchema)
     *     .audit(historySchema)
     *     .derive((changes, cb) => cb(changes.map(c => ({ ... }))))
     *     .proxy()
     *     .create();
     * ```
     *
     * The rows are appended to the same save, so on a backend with an atomic batch they commit
     * with the change they describe.
     */
    audit<TAudit extends {}>(auditSchema: CompiledSchema<TAudit>) {
        return new AuditingCollectionBuilder<TEntity, TAudit, CollectionBuilder<TEntity, TStore>>(
            auditSchema,
            this.dependencies,
            () => new CollectionBuilder<TEntity, TStore>({
                onCollectionCreated: this._onCollectionCreated,
                dependencies: this.dependencies
            })
        );
    }

    /**
     * Index this collection's `.searchable()` properties for full-text search.
     *
     * ```ts
     * articles = this.collection(articleSchema)
     *     .fullTextSearch()
     *     .proxy()
     *     .create();
     * ```
     *
     * The schema decides WHAT can be indexed — `s.string().searchable()` — and this decides that
     * it is. Marking properties without declaring this costs nothing: no index exists, and no
     * save pays for one.
     *
     * Every option has a default, so the no-argument call is the whole opt-in:
     *
     * ```ts
     * .fullTextSearch({ stopWords: 'english', minTokenLength: 3 })
     * ```
     *
     * Supplying `tokenizer` replaces the built-in pipeline entirely, so it cannot be combined
     * with `lowercase`, `minTokenLength`, `maxTokenLength` or `stopWords` — that throws rather
     * than ignoring them.
     */
    fullTextSearch(options?: FullTextSearchOptions): CollectionBuilder<TEntity, TStore> {

        addFullTextSearch(this.dependencies, options);

        return new CollectionBuilder<TEntity, TStore>({
            onCollectionCreated: this._onCollectionCreated,
            dependencies: this.dependencies
        });
    }

    /**
     * Turn a removal into a stamp on `selector`'s property, and hide stamped rows from reads.
     *
     * The property must be declared on the schema and be nullable or optional — a row that was
     * never deleted has nothing to put there. A date is preferred over a boolean because it
     * records WHEN, which is the question a soft-deleted row usually has to answer later.
     *
     * ```ts
     * products = this.collection(productSchema)
     *     .softDelete(x => x.deletedAt)
     *     .proxy()
     *     .create();
     * ```
     *
     * `removeAsync` then writes the timestamp instead of deleting, and every query on this
     * collection is scoped to rows where it is still empty. To read deleted rows, open a
     * second STORE over the same database whose collection omits this — a store rejects two
     * collections over one schema, and reading deleted rows is different enough to be worth
     * its own declaration anyway.
     */
    softDelete(selector: GenericFunction<InferType<TEntity>, unknown>): CollectionBuilder<TEntity, TStore> {

        addSoftDelete(this.dependencies, selector);

        return new CollectionBuilder<TEntity, TStore>({
            onCollectionCreated: this._onCollectionCreated,
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
     *   .proxy()
     *   .create();
     *
     * @param expression A filter expression that will be AND-ed with all user queries
     * @returns A builder for chaining additional configuration
     */
    scope(expression: Filter<InferType<TEntity>>): CollectionBuilder<TEntity, TStore>;
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
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): CollectionBuilder<TEntity, TStore>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P): CollectionBuilder<TEntity, TStore> {

        addScope(this.dependencies, selector, params);

        return new CollectionBuilder<TEntity, TStore>({
            onCollectionCreated: this._onCollectionCreated,
            dependencies: this.dependencies
        });
    }
}

/**
 * A collection builder whose change-tracking mode has been chosen — the only builder with
 * `create()`.
 */
export class ConfiguredCollectionBuilder<TEntity extends {}, TCollection extends CollectionBase<TEntity, any>, TStore = unknown> {

    private _onCollectionCreated: (collection: CollectionBase<TEntity, any>) => void;
    private instanceCreator: CollectionInstanceCreator<TEntity, TCollection>;
    private dependencies: CollectionDependencies<TEntity>;

    constructor(props: ConfiguredProps<TEntity, TCollection>) {
        this.dependencies = props.dependencies;
        this._onCollectionCreated = props.onCollectionCreated;
        this.instanceCreator = props.instanceCreator;
    }

    /** See CollectionBuilder.audit — it may also be declared after the mode is chosen. */
    audit<TAudit extends {}>(auditSchema: CompiledSchema<TAudit>) {
        return new AuditingCollectionBuilder<TEntity, TAudit, ConfiguredCollectionBuilder<TEntity, TCollection, TStore>>(
            auditSchema,
            this.dependencies,
            () => new ConfiguredCollectionBuilder<TEntity, TCollection, TStore>({
                onCollectionCreated: this._onCollectionCreated,
                instanceCreator: this.instanceCreator,
                dependencies: this.dependencies
            })
        );
    }

    /** See CollectionBuilder.fullTextSearch — it may also be declared after the mode is chosen. */
    fullTextSearch(options?: FullTextSearchOptions): ConfiguredCollectionBuilder<TEntity, TCollection, TStore> {

        addFullTextSearch(this.dependencies, options);

        return new ConfiguredCollectionBuilder<TEntity, TCollection, TStore>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: this.instanceCreator,
            dependencies: this.dependencies
        });
    }

    /** See CollectionBuilder.softDelete — it may also be declared after the mode is chosen. */
    softDelete(selector: GenericFunction<InferType<TEntity>, unknown>): ConfiguredCollectionBuilder<TEntity, TCollection, TStore> {

        addSoftDelete(this.dependencies, selector);

        return new ConfiguredCollectionBuilder<TEntity, TCollection, TStore>({
            onCollectionCreated: this._onCollectionCreated,
            instanceCreator: this.instanceCreator,
            dependencies: this.dependencies
        });
    }

    /** See CollectionBuilder.scope — a scope may also be added after the mode is chosen. */
    scope(expression: Filter<InferType<TEntity>>): ConfiguredCollectionBuilder<TEntity, TCollection, TStore>;
    scope<P extends {}>(selector: ParamsFilter<InferType<TEntity>, P>, params: P): ConfiguredCollectionBuilder<TEntity, TCollection, TStore>;
    scope<P extends {} = never>(selector: ParamsFilter<InferType<TEntity>, P> | Filter<InferType<TEntity>>, params?: P): ConfiguredCollectionBuilder<TEntity, TCollection, TStore> {

        addScope(this.dependencies, selector, params);

        return new ConfiguredCollectionBuilder<TEntity, TCollection, TStore>({
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
