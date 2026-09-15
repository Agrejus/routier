import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { ExecutedQuery } from "./query/explain";
import { QueryOptionsCollection } from "./query/QueryOptionsCollection";
import { CompiledSchema, InferType } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "../collections";
import { ITranslatedValue } from "./translators";

/**
 * Interface for a database plugin, which provides query, destroy, and bulk operations.
 */
export interface IDbPlugin {
    /**
     * Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
     * bare name would collide — `orders.db` in two directories is two databases, and `mydb`
     * on two hosts is two databases. Two instances over the same database must return the
     * same string, in this process and in any other; two over different databases must not.
     *
     * Used to scope schema subscription channels, so instances of one database (another tab,
     * a worker) see each other's change notifications and unrelated databases holding the
     * same schema do not.
     *
     * Required rather than optional on purpose. An absent value used to fall back to scoping
     * by schema alone, which shares one channel across every database holding that schema —
     * the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
     * wrapper that forgets to forward it a compile error rather than a silent regression.
     *
     * Derive it, never generate it: a random value is unique per PROCESS, not per database,
     * so another tab would never match one and cross-context notifications would stop.
     *
     * Must not contain credentials — it becomes part of a channel key, so build it from
     * host/port/database rather than returning a connection string.
     */
    readonly databaseName: string;
    /**
     * Executes a query operation on the database.
     * @param event The query event containing schema, parent, and query operation.
     * @param done Callback with the result or error.
     */
    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void;
    /**
     * Destroys or cleans up the plugin, closing connections or freeing resources.
     * @param done Callback with an optional error.
     */
    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void;
    /**
     * Executes bulk operations (add, update, remove) on the database.
     * @param event The bulk operations event containing schema, parent, and changes.
     * @param done Callback with the result or error.
     */
    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void;
}

/**
 * Event for a query operation, including schema, parent, and the query operation.
 */
export type DbPluginQueryEvent<TRoot extends {}, TShape> = DbPluginOperationEvent<IQuery<TRoot, TShape>> & {
    /**
     * Whether the caller asked for an explanation. Required, never optional: a query is
     * either explained or it is not, and "unset" is not a third state.
     *
     * A plugin is free to ignore it. One that reports unconditionally is correct; one that
     * checks the flag to skip building report strings is also correct. What a plugin must
     * NOT do is treat `true` as an instruction it has to obey — a plugin that cannot report
     * simply doesn't, and the datastore marks the step as not reported.
     */
    explain: boolean;
    /**
     * Where a plugin reports what it executed. Pushing to it is how a plugin supports
     * `.explain()` — a plugin that never pushes still answers queries, and its explanations
     * mark the database step as not reported (`executedQueriesUnsupported`) instead of
     * showing statements.
     *
     * The datastore decides whether anyone sees it: with `explain` on it reads the array and
     * an empty one means "not supported"; with `explain` off it takes no action either way.
     *
     * An array the DATASTORE creates and the plugin pushes into, rather than a value the plugin
     * returns. The result envelope is rebuilt in at least six places between a plugin and the
     * caller — the memory half re-translates, joins build fresh tuple values, the cache
     * reconstructs from stored entries — so anything carried on it is discarded before arrival.
     * The event is not rebuilt, and an array survives the shallow spread in `ConcurrencyDbPlugin`
     * because both sides then hold the same array. Assigning a new one would not.
     *
     * Push once per query actually executed, in execution order, so a join reports both reads.
     * `text` is whatever the backend runs — SQL for a SQL engine, a description of the access
     * path for a store that has no statement. A plugin that answered without touching its
     * backend pushes a description of that instead — `CacheDbPlugin` pushes "cache hit" —
     * because pushing nothing reads as "this plugin does not report".
     *
     * Push AFTER the query runs, not before. `RetryDbPlugin` re-invokes with the same event, so
     * a plugin that pushes first reports an entry per failed attempt.
     *
     * The array accumulates for as long as the event lives. That is why `.explain()` is not
     * offered on a subscribed queryable: `subscribeQuery` builds its event once and re-issues it
     * on every change notification, which would grow this without bound.
     */
    executedQueries: ExecutedQuery[];
};

/**
 * Event for bulk operations, including schema, parent, and the entity changes.
 */
export type DbPluginBulkPersistEvent = DbPluginOperationEvent<BulkPersistChanges>;

/**
 * Base event for all plugin operations, containing the schema and parent.
 */
export type DbPluginEvent = {
    /** The compiled schema for the entity. */
    schemas: SchemaCollection;

    /** Unique id of the event. */
    id: string;

    /** The class/component that triggered this event */
    source: string;

    /** The action/operation type being performed */
    action: "query" | "persist" | "destroy";

    /** Optional context about why this operation is happening */
    reason?: string;
}

/**
 * Event for a specific plugin operation, extending the base event with an operation payload.
 */
export type DbPluginOperationEvent<TOperation> = DbPluginEvent & {
    /** The operation payload (query, changes, etc.). */
    operation: TOperation;
}

/**
 * Represents a collection of database plugins with a primary source and optional replicas.
 * Used for implementing read/write separation and high availability.
 */
export type ReplicationPluginOptions = {
    /** The primary database plugin that handles all write operations, do not include in the list of replicas. */
    source: IDbPlugin;
    /** Array of replica database plugins that can be used for read operations. */
    replicas: IDbPlugin[];
    /**
     * The primary database plugin that handles all read operations, do not include in the list of replicas.
     * Used when the source plugin should generate the identity properties, but the read replica will only
     * read data. Typically this is a MemoryPlugin. Should not be included in the list of replicas.
     */
    read?: IDbPlugin;
}

/**
 * A value inside a delta. Arrays and Dates are values, not sub-structures to descend into.
 *
 * Descending into them would be both wrong and useless: an element-wise array delta cannot
 * express "the last element was removed", and a partial Date is meaningless.
 */
type DeltaValue<V> =
    V extends readonly unknown[] ? V
    : V extends Date ? V
    : V extends object ? DeltaProperties<V>
    : V;

type DeltaProperties<T> = { [K in keyof T]?: DeltaValue<T[K]> };

/**
 * What changed about an entity, expressed as a **partial entity**.
 *
 * A change two levels deep appears where it actually lives —
 * `{ nested: { inner: { value } } }` — not as a flattened key.
 *
 * This deliberately carries no storage vocabulary. It used to be typed
 * `{ [key: string]: string | number | Date }`, which was wrong twice over: it excluded
 * booleans, nulls, arrays and objects that the schema happily allows, and its flat
 * scalar shape was really a SQL `SET column = ?` list — one storage family's concern
 * leaking into the contract every plugin sees.
 *
 * Translating this into storage terms belongs to the plugin. A document store can merge it
 * as-is; a SQL plugin decides which columns it touches and how a nested value is encoded
 * (see `toColumnAssignments` in `@routier/sql-plugin-core`, which stores nested objects and
 * arrays as JSON). Core does not need to know, and must not.
 */
export type EntityDelta<T extends {}> = DeltaProperties<InferType<T>>;

export type EntityUpdateInfo<T extends {}> = {
    entity: InferType<T>,
    changeType: EntityChangeType;
    delta: EntityDelta<T>
    /**
     * Present when the schema declares a `.concurrency()` token: the update must be
     * applied ONLY IF the stored row's `column` still equals `expected` (the value the
     * writer read). The entity/delta already carry the bumped value to store on success.
     * A plugin that finds a mismatch must fail the whole save with an
     * OptimisticConcurrencyError naming the conflicted rows — never apply partially.
     */
    concurrency?: { column: string; expected: number };
    /**
     * The values these properties held BEFORE this update — keyed like `delta`, which holds
     * the values they hold after.
     *
     * DATASTORE-INTERNAL. The datastore strips it before the plugin is called
     * (`DataStore.onSavePreparedChanges`), so no plugin ever receives it and nothing goes over
     * a wire. It exists for save-pipeline participants that must undo work keyed by an old
     * value — a search index has to delete the rows for terms that just left a field, and
     * `delta` only says what the field says now.
     *
     * Always populated for an update. It is part of what an update IS, not something a
     * declaration switches on — a consumer can rely on it without knowing what else the store
     * declared, and there is one code path to reason about rather than two.
     *
     * Which properties appear depends on what the change-tracking mode can know. Proxy and
     * immutable name exactly the properties that changed. Diff detects change by comparing a
     * content hash, so it cannot say WHICH property moved and reports every root property —
     * the same "assume everything" convention its empty `delta` already uses.
     */
    previous?: EntityDelta<T>;
}

export type TaggedEntity<T> = {
    entity: T;
    tag?: unknown
}

/**
 * Interface for a query operation, including expression, options, filters, and change tracking.
 */
export type IQuery<TRoot extends {}, TShape> = {

    /** Query options (sort, skip, take, etc.). */
    options: QueryOptionsCollection<TShape>;

    schema: CompiledSchema<TRoot>;
    /**
     * Whether change tracking is enabled for the query result.
     * Only enabled when the response is not reduced/aggregated/mapped.
     */
    get changeTracking(): boolean;
};

export type EntityChangeType = "propertiesChanged" | "markedDirty" | "notModified";
