import { Collection } from './collections/Collection';
import { CollectionBuilder } from './collection-builder/CollectionBuilder';
import { CollectionPipelines } from './types';
import { DbPluginBulkPersistEvent, DbPluginEvent, IDbPlugin, QueryOptionsCollection } from '@routier/core/plugins';
import { CompiledSchema, SchemaId } from '@routier/core/schema';
import { PartialResultType, Result } from '@routier/core/results';
import { BulkPersistChanges, BulkPersistResult, SchemaCollection, ReadonlySchemaCollection } from '@routier/core/collections';
import { UnknownRecord, uuid } from '@routier/core/utilities';
import { View } from './views/View';
import { ViewBuilder } from './view-builder/ViewBuilder';
import { CollectionBase } from './collections/CollectionBase';
import { CollectionDependencies } from './collections/types';
import { ChangeTracker } from './change-tracking/ChangeTracker';
import { DataBridge } from './data-access/DataBridge';

/**
 * The main Routier class, providing collection management, change tracking, and persistence for entities.
 *
 * @implements Disposable
 */
export class DataStore implements Disposable {

    /** The underlying database plugin used for persistence. */
    protected readonly dbPlugin: IDbPlugin;
    /** Map of schema key to collection instances. */
    protected readonly collections: Map<SchemaId, CollectionBase<any>>;
    /** Pipelines for save and hasChanges operations (no longer used, kept for compatibility). */
    protected readonly collectionPipelines: CollectionPipelines;
    /** AbortController for managing cancellation and disposal. */
    protected readonly abortController: AbortController;

    protected readonly _schemas: SchemaCollection;

    get schemas() {
        return new ReadonlySchemaCollection([...this._schemas]);
    }

    /**
     * Constructs a new Routier instance.
     * @param dbPlugin The database plugin to use for persistence.
     */
    constructor(dbPlugin: IDbPlugin) {
        this.abortController = new AbortController();
        this.dbPlugin = dbPlugin;
        this.collections = new Map<SchemaId, CollectionBase<any>>();
        this._schemas = new SchemaCollection();
        this.collectionPipelines = {};
    }

    getDbPlugin<T extends IDbPlugin>() {
        return this.dbPlugin as T;
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected collection<TEntity extends {}>(schema: CompiledSchema<TEntity>) {
        const onCreated = (collection: Collection<TEntity>) => {

            if (this.collections.has(schema.id)) {
                throw new Error(`Cannot have two collections/views with the same schema.  Schema Collection Name: ${schema.collectionName}`);
            }

            this.collections.set(schema.id, collection);
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };

        const dependencies = new CollectionDependencies<TEntity>(
            this.dbPlugin,
            schema,
            this._schemas,
            this.collectionPipelines,
            this.abortController.signal,
            new QueryOptionsCollection<TEntity>(),
            schema.createSubscription(this.abortController.signal),
            new ChangeTracker<TEntity>(schema),
            DataBridge.create<TEntity>(this.dbPlugin, schema, this.abortController.signal)
        );

        return new CollectionBuilder<TEntity, Collection<TEntity>>({
            dependencies,
            instanceCreator: Collection<TEntity>,
            onCollectionCreated: onCreated.bind(this),
        });
    }

    /**
     * Creates a new collection builder for the given schema.
     * @param schema The compiled schema for the entity type.
     * @returns A CollectionBuilder for the entity type.
     */
    protected view<TEntity extends {}>(schema: CompiledSchema<TEntity>) {

        if (schema.idProperties.some(x => x.isIdentity)) {
            throw new Error("View cannot have an identty key.  Must be a known/computed key so Routier can find and update the record");
        }

        const onCreated = (view: View<TEntity>) => {

            if (this.collections.has(schema.id)) {
                throw new Error(`Cannot have two collections/views with the same schema.  Schema Collection Name: ${schema.collectionName}`);
            }

            this.collections.set(schema.id, view);
            this._schemas.set(schema.id, schema as CompiledSchema<UnknownRecord>);
        };

        const dependencies = new CollectionDependencies<TEntity>(
            this.dbPlugin,
            schema,
            this._schemas,
            this.collectionPipelines,
            this.abortController.signal,
            new QueryOptionsCollection<TEntity>(),
            schema.createSubscription(this.abortController.signal),
            new ChangeTracker<TEntity>(schema),
            DataBridge.create<TEntity>(this.dbPlugin, schema, this.abortController.signal)
        );

        return new ViewBuilder<TEntity, View<TEntity>>({
            dependencies,
            instanceCreator: View<TEntity>,
            onCollectionCreated: onCreated.bind(this),
        });
    }

    /**
     * Saves all changes in all collections.
     * @returns A promise resolving to the result of the save operation.
     */
    async saveChanges(): Promise<BulkPersistResult> {
        // Prepare changes from all collections
        const preparedChanges: PartialResultType<BulkPersistChanges> = {
            data: new BulkPersistChanges(),
            ok: Result.SUCCESS
        };

        // Call prepare on each collection
        for (const [, collection] of this.collections) {
            await collection['prepare'](preparedChanges);
        }

        // Execute bulk persist
        const bulkPersistResult: BulkPersistResult = await this.dbPlugin.bulkPersist({
            id: uuid(8),
            operation: preparedChanges.data,
            schemas: this._schemas,
            source: "data-store"
        } as DbPluginBulkPersistEvent);

        // Call afterPersist on each collection
        const afterPersistData: PartialResultType<{ changes: BulkPersistChanges, result: BulkPersistResult }> = {
            data: { changes: preparedChanges.data, result: bulkPersistResult },
            ok: Result.SUCCESS
        };

        for (const [, collection] of this.collections) {
            await collection['afterPersist'](afterPersistData);
        }

        return bulkPersistResult;
    }

    /**
     * Saves all changes in all collections asynchronously.
     * @returns A promise resolving to the number of changes saved.
     * @deprecated Use saveChanges() instead
     */
    saveChangesAsync() {
        return this.saveChanges();
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     */
    async previewChanges(): Promise<BulkPersistChanges> {
        const preparedChanges: PartialResultType<BulkPersistChanges> = {
            data: new BulkPersistChanges(),
            ok: Result.SUCCESS
        };

        // Call prepare on each collection
        for (const [, collection] of this.collections) {
            await collection['prepare'](preparedChanges);
        }

        return preparedChanges.data;
    }

    /**
     * Computes and returns the pending changes that would be sent to the database plugin's bulkOperations method asynchronously.
     * This method allows inspection of changes before they are actually persisted.
     * @returns A promise resolving to the entity changes.
     * @deprecated Use previewChanges() instead
     */
    previewChangesAsync() {
        return this.previewChanges();
    }

    /**
     * Checks if there are any unsaved changes in the collections.
     * @returns A promise resolving to true if there are changes, false otherwise.
     */
    async hasChanges(): Promise<boolean> {
        for (const [, collection] of this.collections) {
            if (collection.hasChanges()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks asynchronously if there are any unsaved changes in the collections.
     * @returns A promise resolving to true if there are changes, false otherwise.
     * @deprecated Use hasChanges() instead
     */
    hasChangesAsync() {
        return this.hasChanges();
    }

    /**
     * Destroys the Routier instance and underlying database plugin.
     * @returns A promise that resolves when destruction is complete.
     */
    async destroy(): Promise<void> {
        await this.dbPlugin.destroy({
            id: uuid(8),
            schemas: this._schemas,
            source: "data-store"
        } as DbPluginEvent);
    }

    /**
     * Destroys the Routier instance and underlying database plugin asynchronously.
     * @returns A promise that resolves when destruction is complete.
     * @deprecated Use destroy() instead
     */
    destroyAsync() {
        return this.destroy();
    }

    /**
     * Disposes the Routier instance, aborting any ongoing operations and subscriptions.
     */
    [Symbol.dispose]() {
        // should clear and detach everything in the change tracker?
        this.abortController.abort("Data Store disposed");

        for (const [, collection] of this.collections) {
            collection.dispose();
        }
    }
}