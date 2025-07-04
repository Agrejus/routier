import { CompiledSchema, DeepPartial, Expression, IdType, InferCreateType, InferType, QueryOptionsCollection, TagCollection } from "..";
import { SchemaParent } from "../schema";

/**
 * Interface for a database plugin, which provides query, destroy, and bulk operations.
 */
export interface IDbPlugin {
    /**
     * Executes a query operation on the database.
     * @param event The query event containing schema, parent, and query operation.
     * @param done Callback with the result or error.
     */
    query<TRoot extends {}, TShape extends any = TRoot>(event: DbPluginQueryEvent<TRoot, TShape>, done: (result: TShape, error?: any) => void): void;
    /**
     * Destroys or cleans up the plugin, closing connections or freeing resources.
     * @param done Callback with an optional error.
     */
    destroy(done: (error?: any) => void): void;
    /**
     * Executes bulk operations (add, update, remove) on the database.
     * @param event The bulk operations event containing schema, parent, and changes.
     * @param done Callback with the result or error.
     */
    bulkOperations<TRoot extends {}>(event: DbPluginBulkOperationsEvent<TRoot>, done: (result: EntityModificationResult<TRoot>, error?: any) => void): void;
}

/**
 * Event for a query operation, including schema, parent, and the query operation.
 */
export type DbPluginQueryEvent<TRoot extends {}, TShape> = DbPluginOperationEvent<TRoot, IQuery<TRoot, TShape>>;

/**
 * Event for bulk operations, including schema, parent, and the entity changes.
 */
export type DbPluginBulkOperationsEvent<TEntity extends {}> = DbPluginOperationEvent<TEntity, EntityChanges<TEntity>>;

/**
 * Base event for all plugin operations, containing the schema and parent.
 */
export type DbPluginEvent<TEntity extends {}> = {
    /** The compiled schema for the entity. */
    schema: CompiledSchema<TEntity>;
    /** The parent schema context. */
    parent: SchemaParent;
}

/**
 * Event for a specific plugin operation, extending the base event with an operation payload.
 */
export type DbPluginOperationEvent<TEntity extends {}, TOperation> = DbPluginEvent<TEntity> & {
    /** The operation payload (query, changes, etc.). */
    operation: TOperation;
}

/**
 * Represents a collection of database plugins with a primary source and optional replicas.
 * Used for implementing read/write separation and high availability.
 */
export type IdbPluginCollection = {
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
 * Represents a set of changes to entities: additions, removals, and updates.
 */
export type EntityChanges<T extends {}> = {
    /** Entities to add. */
    adds: {
        entities: InferCreateType<T>[]
    };
    /** Entities to remove. */
    removes: {
        entities: InferType<T>[];
        queries: IQuery<T, T>[];
    };
    /**
     * Entities to update, mapped by ID. Each update includes the new doc and a delta of changed fields.
     */
    updates: {
        entities: Map<IdType, EntityUpdateInfo<T>>;
    };

    tags: TagCollection;
}

export type EntityUpdateInfo<T extends {}> = {
    doc: InferType<T>,
    changeType: EntityChangeType;
    delta: { [key: string]: string | number | Date }
}

export type TaggedEntity<T> = {
    entity: T;
    tag?: unknown
}

/**
 * The result of entity modifications: added, removed, and updated entities.
 */
export type EntityModificationResult<T extends {}> = {
    /** Entities that were added (may be partial). */
    adds: DeepPartial<InferCreateType<T>>[];
    /** Number of entities removed. */
    removedCount: number;
    /** Entities that were updated. */
    updates: InferType<T>[];
}

/**
 * Interface for a query operation, including expression, options, filters, and change tracking.
 */
export type IQuery<TRoot extends {}, TShape> = {

    /** Query options (sort, skip, take, etc.). */
    options: QueryOptionsCollection<TShape>;

    /**
     * Whether change tracking is enabled for the query result.
     * Only enabled when the response is not reduced/aggregated/mapped.
     */
    get changeTracking(): boolean;
};

export type EntityChangeType = "propertiesChanged" | "markedDirty" | "notModified";