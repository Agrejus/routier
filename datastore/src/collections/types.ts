import { SchemaCollection } from "@routier/core/collections";
import { AuditRegistry } from "../collection-builder/audit";
import { FullTextSearchRegistry } from "../collection-builder/fullTextSearch";
import { IDbPlugin, QueryOptionsCollection } from "@routier/core/plugins";
import { ChangeTrackingType, CompiledSchema, ISchemaSubscription } from "@routier/core/schema";
import { ChangeTracker } from "../change-tracking/ChangeTracker";
import { DataBridge } from "../data-access/DataBridge";
import { CollectionPipelines, ResolvedDataStoreOptions } from "../types";
import { uuid } from "@routier/core";

export class ComposerDependencies<TRoot extends {}> {
    readonly schema: CompiledSchema<TRoot>;

    constructor(
        schema: CompiledSchema<TRoot>,
    ) {
        this.schema = schema;
    }
}

export class CollectionDependencies<TRoot extends {}> extends ComposerDependencies<TRoot> {
    readonly plugin: IDbPlugin;
    readonly schemas: SchemaCollection;
    readonly pipelines: CollectionPipelines;
    readonly signal: AbortSignal;
    readonly subscription: ISchemaSubscription<TRoot>;
    readonly changeTracker: ChangeTracker<TRoot>;
    readonly dataBridge: DataBridge<TRoot>;
    readonly scopedQueryOptions: QueryOptionsCollection<TRoot>;
    /** Every audit declaration in the store. Shared, because auditing runs once per save. */
    readonly audits: AuditRegistry;
    /** Every full-text search declaration in the store. Shared for the same reason as `audits`. */
    readonly fullTextSearches: FullTextSearchRegistry;
    /**
     * The store this collection belongs to — what a `join(s => s.other, ...)` selector receives.
     *
     * Untyped here on purpose. The store's TYPE travels on the collection classes (via `this` in
     * `DataStore.collection()`), which is where the selector is written and checked; typing it
     * here as well would make `CollectionDependencies` generic over the store and drag that
     * parameter through every internal that only ever needs the schema.
     *
     * Held as a reference, never read during construction: a store assigns its collections in its
     * own field initializers, so `this` is only half-built when it arrives here. By the time a
     * selector runs — query build time — the store is complete.
     */
    readonly store: unknown;
    /** Store-wide settings, defaults already filled in. */
    readonly storeOptions: ResolvedDataStoreOptions;

    constructor(
        plugin: IDbPlugin,
        schema: CompiledSchema<TRoot>,
        schemas: SchemaCollection,
        pipelines: CollectionPipelines,
        signal: AbortSignal,
        scopedQueryOptions: QueryOptionsCollection<TRoot>,
        subscription: ISchemaSubscription<TRoot>,
        changeTracker: ChangeTracker<TRoot>,
        dataBridge: DataBridge<TRoot>,
        audits: AuditRegistry,
        store: unknown,
        storeOptions: ResolvedDataStoreOptions,
        fullTextSearches: FullTextSearchRegistry
    ) {
        super(schema);
        this.plugin = plugin;
        this.schemas = schemas;
        this.pipelines = pipelines;
        this.signal = signal;
        this.subscription = subscription;
        this.changeTracker = changeTracker;
        this.dataBridge = dataBridge;
        this.scopedQueryOptions = scopedQueryOptions;
        this.audits = audits;
        this.store = store;
        this.storeOptions = storeOptions;
        this.fullTextSearches = fullTextSearches;
    }
}

/**
 * What a join needs from the collection on the OTHER side.
 *
 * Three things, and each earns its place. The schema deserializes the inner half of every tuple
 * and resolves the inner key. The scoped options carry the inner collection's soft-delete scope
 * and `.scope()` filters, which a join bypasses the read path of and would otherwise lose. The
 * plugin decides who interprets the join at all: same instance and the option travels to it,
 * different instance and the datastore has to run both sides itself.
 *
 * Compared by INSTANCE, never by `databaseName` — two plugins over one database are still two
 * interpreters, and neither can read the other's rows.
 */
export type JoinSide<TInner extends {}> = {
    readonly schema: CompiledSchema<TInner>;
    readonly plugin: IDbPlugin;
    readonly scopedQueryOptions: QueryOptionsCollection<TInner>;
};

/**
 * A collection or view, seen as the inner side of a join.
 *
 * Structural rather than `CollectionBase<TInner>` so the queryables can name it without
 * importing the collection they are built by. Views satisfy it because they extend
 * `CollectionBase` — which is a requirement, not a bonus: full-text search joins its index view
 * to its source collection.
 */
export type CollectionRef<TInner extends {}> = {
    joinSide(): JoinSide<TInner>;
};

/**
 * How a join names its inner side: pick it off the store, or hand it over directly.
 *
 * ```ts
 * store.players.join(s => s.playerMatches, p => p._id, m => m.playerId)   // same store
 * store.players.join(other.playerMatches, p => p._id, m => m.playerId)    // another store
 * ```
 *
 * The selector is the everyday form — a store can see its own collections, so naming the store
 * twice to reach a sibling is noise. It is resolved when the join is recorded, not at execution,
 * so a typo is a compile error rather than a query that returns nothing.
 *
 * The direct form stays because the selector cannot express the one case that needs it: an inner
 * collection on a DIFFERENT store. That join is supported (the datastore reads both sides and
 * pairs them itself), and `s => ...` has no way to reach outside the store it was handed.
 */
export type JoinTarget<TStore, TInner extends {}> =
    | ((store: TStore) => CollectionRef<TInner>)
    | CollectionRef<TInner>;

/**
 * The inner side of the join this request records, as LIVE references.
 *
 * Kept beside the query rather than inside the `join` option because the option is built to be
 * serializable and a plugin instance is not. Only the datastore reads this, and only when it has
 * to interpret the join itself (the cross-plugin case).
 */
export type RequestJoinSide = {
    readonly plugin: IDbPlugin;
    readonly schema: CompiledSchema<any>;
};

export class RequestContext<TRoot extends {}> {

    /**
     * @param changeTrackingType how entities from this request are tracked. Supplied by the
     *   collection rather than defaulted here: `ImmutableCollection` and `DiffCollection`
     *   override it, and hardcoding "proxy" meant their queries installed tracking proxies
     *   anyway — so those modes only ever applied to writes, never to reads.
     */
    constructor(changeTrackingType: ChangeTrackingType = "proxy") {
        this.queryOptions = new QueryOptionsCollection<TRoot>();
        this.isSubScribed = false;
        this.changeTrackingType = changeTrackingType;
        this.id = uuid(8);
    }

    isSubScribed: boolean;
    /** Set by `.join()`/`.leftJoin()`. See `RequestJoinSide`. */
    joinSide: RequestJoinSide | null = null;
    /** Set by `.explain()`. See `withExplainOn`. */
    isExplained: boolean = false;
    readonly queryOptions: QueryOptionsCollection<TRoot>;
    readonly changeTrackingType: ChangeTrackingType;
    readonly id: string;

    /**
     * A copy that explains, sharing this request's query options.
     *
     * A copy rather than a flag set in place, because `QueryableExecutor.create` passes the
     * SAME request to every queryable it derives — so setting `isExplained` here would make an
     * earlier queryable in the chain start returning `{ data, explanation }` while its type
     * still says it returns rows. The caller reads `.length` off an object and gets `undefined`,
     * with nothing to indicate why.
     *
     * The options collection is shared, not copied, because that is how every other chained
     * call already behaves — `.explain()` marks how results are delivered, not what is queried.
     */
    withExplainOn(): RequestContext<TRoot> {
        const copy = Object.create(Object.getPrototypeOf(this)) as RequestContext<TRoot>;

        Object.assign(copy, this, { isExplained: true });

        return copy;
    }
}
