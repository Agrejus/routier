import { PluginEventCallbackPartialResult, PluginEventCallbackResult } from "../results";
import { QueryOptionsCollection } from "./query/QueryOptionsCollection";
import { CompiledSchema, InferType } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "../collections";

/**
 * Interface for a database plugin, which provides query, destroy, and bulk operations.
 */
export interface IDbPlugin {
    /**
     * Executes a query operation on the database.
     * @param event The query event containing schema, parent, and query operation.
     * @param done Callback with the result or error.
     */
    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: PluginEventCallbackResult<TShape>): void;
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

    /** Source of the request */
    source: "data-store" | "collection" | "view";
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

export type OptimisticReplicationPluginOptions = {
    /** The primary database plugin that handles all write operations, do not include in the list of replicas. */
    source: IDbPlugin;

    /** Array of replica database plugins that can be used for read operations. */
    replicas: IDbPlugin[];

    /** Must be a MemoryPlugin */
    read: IDbPlugin;
}


export type EntityUpdateInfo<T extends {}> = {
    entity: InferType<T>,
    changeType: EntityChangeType;
    delta: { [key: string]: string | number | Date }
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
