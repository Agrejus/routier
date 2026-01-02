import { PluginEventResult, Result } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, OptimisticReplicationPluginOptions } from '../types';
import { CompiledSchema } from '../../schema';
import { Query } from '../query';
import { resolveBulkPersistChanges, uuid } from '../../utilities';
import { BulkPersistChanges, BulkPersistResult } from '../../collections';
import { ITranslatedValue } from '../translators';
import { now } from '../../performance';
import { HydrationStatus } from './types';

const getMemoryPluginCollectionSize = <T extends {}>(plugin: IDbPlugin, schema: CompiledSchema<T>): number => {

    if ("getCollectionSize" in plugin && typeof plugin.getCollectionSize === "function") {
        return plugin.getCollectionSize(schema.collectionName) as number;
    }

    throw new Error("Cannot get size of collection for MemoryPlugin, not an instance of MemoryPlugin");
}

const MAX_HYDRATION_WAIT_MS = 60_000; // 60 seconds max wait
const HYDRATION_POLL_INTERVAL_MS = 10; // Check ever 10 ms

export class OptimisticReplicationDbPlugin implements IDbPlugin {

    protected plugins: OptimisticReplicationPluginOptions;
    // Give more control over hydration, if the plugin is destroyed, so is the in memory data.
    // It is up to the dev to control the lifecycle
    private collectionHydrationStatuses: Map<string, HydrationStatus> = new Map<string, HydrationStatus>();

    protected constructor(plugins: OptimisticReplicationPluginOptions) {
        this.plugins = plugins;
    }

    /**
     * Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its replicas.
     * 
     * @param source The primary database plugin that will receive all operations first
     * @param replicas Additional database plugins that will replicate operations from the source
     * @returns A new DbPluginReplicator instance that manages the source-replica relationship
     */
    static create(plugins: OptimisticReplicationPluginOptions) {
        return new OptimisticReplicationDbPlugin(plugins);
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    async query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>): Promise<ITranslatedValue<TShape>> {
        try {
            const readPlugin = this.plugins.read;
            const sourcePlugin = this.plugins.source;
            const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, event.operation.schema);

            if (collectionSize === 0 && this.collectionHydrationStatuses.get(event.operation.schema.collectionName) == null) {
                // Notify the cache that the db was hydrated right away
                this.collectionHydrationStatuses.set(event.operation.schema.collectionName, "pending");

                try {
                    // nothing is hydrated, let's try and hydrate before querying
                    // Memory plugin might not be hydrated, lets hydrate it for the targeted schema only,
                    // Other queries will do the same and hydrate if needed
                    // We want to select all data here
                    const sourceResult = await sourcePlugin.query<TEntity, TShape>({
                        id: uuid(8),
                        schemas: event.schemas,
                        source: "collection",
                        // Select All Data
                        operation: Query.EMPTY<TEntity, TShape>(event.operation.schema)
                    });

                    // Source plugin can have no data, still should succeed
                    if (Array.isArray(sourceResult.value) === false) {
                        // Notify that hydration failed
                        this.collectionHydrationStatuses.set(event.operation.schema.collectionName, "rejected");
                        throw new Error("Query result is not an array");
                    }

                    const changesCollection = new BulkPersistChanges();
                    const schemaChanges = changesCollection.resolve(event.operation.schema.id);

                    // Add the existing items into the persist payload as adds
                    schemaChanges.adds = sourceResult.value;

                    await readPlugin.bulkPersist({
                        id: uuid(8),
                        schemas: event.schemas,
                        operation: changesCollection,
                        source: "collection",
                    });

                    this.collectionHydrationStatuses.set(event.operation.schema.collectionName, "fulfilled");

                    // requery the read plugin
                    return await readPlugin.query(event);
                } catch (error) {
                    // Notify that hydration failed
                    this.collectionHydrationStatuses.set(event.operation.schema.collectionName, "rejected");
                    throw error;
                }
            }

            if (this.collectionHydrationStatuses.get(event.operation.schema.collectionName) === "rejected") {
                throw new Error("Hydration failed, unable to query read plugin");
            }

            // If hydration is pending, do not query empty collection, wait for hydration
            if (this.collectionHydrationStatuses.get(event.operation.schema.collectionName) === "pending") {
                const start = now();

                while (true) {
                    const delta = now() - start;

                    if (delta > MAX_HYDRATION_WAIT_MS) {
                        this.collectionHydrationStatuses.set(event.operation.schema.collectionName, "rejected");
                        throw new Error(`Hydration timeout: exceeded maximum wait time of ${MAX_HYDRATION_WAIT_MS}ms`);
                    }

                    const status = this.collectionHydrationStatuses.get(event.operation.schema.collectionName);

                    if (status === "rejected") {
                        throw new Error("Hydration failed, unable to query read plugin");
                    }

                    if (status === "fulfilled") {
                        // Hydration completed successfully, proceed with query
                        return await readPlugin.query(event);
                    }

                    // Still pending, wait a bit before checking again
                    await new Promise(resolve => setTimeout(resolve, HYDRATION_POLL_INTERVAL_MS));
                }
            }

            // Collection is hydrated for the targeted collection and should be in sync
            return await readPlugin.query(event);
        } catch (e: any) {
            throw e;
        }
    }

    async destroy(event: DbPluginEvent): Promise<void> {
        const plugins = [this.plugins.source, ...this.plugins.replicas];

        for (const plugin of plugins) {
            await plugin.destroy(event);
        }
    }

    async bulkPersist(event: DbPluginBulkPersistEvent): Promise<BulkPersistResult> {
        const deferredPlugins = [this.plugins.source, ...this.plugins.replicas];

        // Since we are doing optimistic, we insert into the read plugin first and assume later plugins will succeed
        // This means the read plugin will generate ids for the source plugin
        const readResult = await this.plugins.read.bulkPersist({
            id: uuid(8),
            operation: event.operation,
            schemas: event.schemas,
            source: "data-store",
        });

        // optimistically return the result and still continue saving the rest of the data.  We read from the memory
        // db anyways
        const optimisticBulkPersistChanges = new BulkPersistChanges();

        // make sure we swap the adds here, that way we can make sure other persist events
        // don't take their additions and try to change subsequent calls
        resolveBulkPersistChanges(event, readResult, optimisticBulkPersistChanges);

        // Fire and forget - continue saving to other plugins asynchronously
        setTimeout(async () => {
            for (const plugin of deferredPlugins) {
                try {
                    await plugin.bulkPersist({
                        id: uuid(8),
                        operation: optimisticBulkPersistChanges,
                        schemas: event.schemas,
                        source: "data-store",
                    });
                } catch (error) {
                    // Silently fail for now, maybe implement retries?
                }
            }
        }, 5);

        return readResult;
    }
}