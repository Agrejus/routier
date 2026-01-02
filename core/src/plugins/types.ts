import { QueryOptionsCollection } from "./query/QueryOptionsCollection";
import { CompiledSchema, InferType } from '../schema';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection } from "../collections";
import { ITranslatedValue } from "./translators";

/**
 * Interface for a database plugin, which provides query, destroy, and bulk operations.
 */
export interface IDbPlugin {
    /**
     * Executes a query operation on the database.
     * @param event The query event containing schema, parent, and query operation.
     * @returns Promise resolving to the query result.
     * @throws Error if the query fails.
     */
    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>): Promise<ITranslatedValue<TShape>>;
    /**
     * Destroys or cleans up the plugin, closing connections or freeing resources.
     * @param event The destroy event.
     * @returns Promise resolving when destruction is complete.
     * @throws Error if destruction fails.
     */
    destroy(event: DbPluginEvent): Promise<void>;
    /**
     * Executes bulk operations (add, update, remove) on the database.
     * @param event The bulk operations event containing schema, parent, and changes.
     * @returns Promise resolving to the result.
     * @throws Error if the operation fails.
     */
    bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult>;
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
    source: "data-store" | "collection" | "view" | "capability";
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
