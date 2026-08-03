import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { QueryOptionsCollection } from "./query/QueryOptionsCollection";
import { CompiledSchema, InferType } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "../collections";
import { ITranslatedValue } from "./translators";

/**
 * Interface for a database plugin, which provides query, destroy, and bulk operations.
 */
export interface IDbPlugin {
    /**
     * Optional stable identity for the underlying database (e.g. its name). Used to scope
     * schema subscription channels: instances sharing an identity (same database in
     * another tab or context) see each other's change notifications, while unrelated
     * databases holding the same schema do not. When omitted, channels are scoped by
     * schema alone and every instance of the schema shares one channel.
     */
    readonly identity?: string;
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
export type DbPluginQueryEvent<TRoot extends {}, TShape> = DbPluginOperationEvent<IQuery<TRoot, TShape>>;

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
