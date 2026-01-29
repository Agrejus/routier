import { BulkPersistChanges, BulkPersistResult } from "@routier/core/collections";
import { now } from "@routier/core/performance";
import { WorkPipeline } from "@routier/core/pipeline";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from "@routier/core/results";
import { CompiledSchema } from "@routier/core/schema";
import { logger, resolveBulkPersistChanges, uuid } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";

const getMemoryPluginCollectionSize = <T extends {}>(plugin: IDbPlugin, schema: CompiledSchema<T>): number => {

    if ("getCollectionSize" in plugin && typeof plugin.getCollectionSize === "function") {
        return plugin.getCollectionSize(schema.collectionName) as number;
    }

    throw new Error("Cannot get size of collection for MemoryPlugin, not an instance of MemoryPlugin");
}

const MAX_HYDRATION_WAIT_MS = 60_000; // 60 seconds max wait
const HYDRATION_POLL_INTERVAL_MS = 10; // Check ever 10 ms

type HydrationStatus = "pending" | "fulfilled" | "rejected";

export class OptimisticUpdatesDbPlugin implements IDbPlugin {

    protected plugins: {
        /** The primary database plugin that handles all write operations, do not include in the list of replicas. */
        source: IDbPlugin;

        /** Must be a MemoryPlugin */
        read: IDbPlugin;
    };

    // Give more control over hydration, if the plugin is destroyed, so is the in memory data.
    // It is up to the dev to control the lifecycle
    private collectionHydrationStatuses: Map<string, HydrationStatus> = new Map<string, HydrationStatus>();

    /**
     * Creates a new OptimisticDbPluginReplicator that coordinates operations between a source database and its in memory store.
     * 
     * @param source The primary database plugin that will receive all operations first
     */
    constructor(source: IDbPlugin) {
        this.plugins = {
            source,
            read: new MemoryPlugin("__optimistic-updates-memory-plugin-db__")
        };
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {
            const collectionName = event.operation.schema.collectionName;
            logger.debug('[OptimisticReplicationDbPlugin] query started', { eventId: event.id, collectionName });

            const readPlugin = this.plugins.read;
            const sourcePlugin = this.plugins.source;
            const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, event.operation.schema);

            if (collectionSize === 0 && this.collectionHydrationStatuses.get(collectionName) == null) {

                // Notify the cache that the db was hydrated right away
                this.collectionHydrationStatuses.set(collectionName, "pending");
                logger.info('[OptimisticReplicationDbPlugin] Collection empty and not hydrated, starting hydration', { collectionName });

                // nothing is hydrated, let's try and hydrate before querying
                // Memory plugin might not be hydrated, lets hydrate it for the targeted schema only,
                // Other queries will do the same and hydrate if needed
                // We want to select all data here
                sourcePlugin.query<TEntity, TShape>({
                    id: uuid(8),
                    schemas: event.schemas,
                    source: "OptimisticReplicationDbPlugin",
                    action: "query",
                    reason: "hydration",
                    // Select All Data
                    operation: Query.EMPTY<TEntity, TShape>(event.operation.schema)
                }, (sourceResult) => {

                    if (sourceResult.ok === Result.ERROR) {
                        logger.error('[OptimisticReplicationDbPlugin] Hydration source query failed', { collectionName, error: sourceResult.error });
                        // Notify that hydration failed
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(sourceResult);
                        return;
                    }

                    // Source plugin can have no data, still should succeed
                    if (Array.isArray(sourceResult.data.value) === false) {
                        logger.error('[OptimisticReplicationDbPlugin] Hydration source result is not an array', { collectionName });
                        // Notify that hydration failed
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(PluginEventResult.error(event.id, "Query result is not an array"));
                        return;
                    }

                    const itemCount = sourceResult.data.value.length;
                    logger.debug('[OptimisticReplicationDbPlugin] Hydration source query succeeded, persisting to read plugin', { collectionName, itemCount });

                    const changesCollection = new BulkPersistChanges();
                    const schemaChanges = changesCollection.resolve(event.operation.schema.id);

                    // Add the existing items into the persist payload as adds
                    schemaChanges.adds = sourceResult.data.value;

                    readPlugin.bulkPersist({
                        id: uuid(8),
                        schemas: event.schemas,
                        operation: changesCollection,
                        source: "OptimisticReplicationDbPlugin",
                        action: "persist",
                        reason: "hydration"
                    }, (readPersistResult) => {

                        if (readPersistResult.ok === Result.ERROR) {
                            logger.error('[OptimisticReplicationDbPlugin] Hydration read-plugin bulkPersist failed', { collectionName, error: readPersistResult.error });
                            // Notify that hydration failed
                            this.collectionHydrationStatuses.set(collectionName, "rejected");
                            done(readPersistResult);
                            return;
                        }

                        this.collectionHydrationStatuses.set(collectionName, "fulfilled");
                        logger.info('[OptimisticReplicationDbPlugin] Hydration complete, requerying read plugin', { collectionName, itemCount, sourceResult, event });

                        // requery the read plugin
                        readPlugin.query(event, r => {

                            logger.info('[OptimisticReplicationDbPlugin] Hydration complete, requerying read plugin RESPONSE', { r });
                            done(r);
                        });
                    });
                });

                return;
            }

            if (this.collectionHydrationStatuses.get(collectionName) === "rejected") {
                logger.warn('[OptimisticReplicationDbPlugin] Query rejected: hydration previously failed', { collectionName });
                done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                return;
            }

            // If hydration is pending, do not query empty collection, wait for hydration
            if (this.collectionHydrationStatuses.get(collectionName) === "pending") {
                logger.debug('[OptimisticReplicationDbPlugin] Hydration pending, polling until fulfilled or timeout', { collectionName });
                const start = now();
                const pollHydrationStatus = () => {
                    const delta = now() - start;

                    if (delta > MAX_HYDRATION_WAIT_MS) {
                        logger.error('[OptimisticReplicationDbPlugin] Hydration timeout', { collectionName, waitedMs: delta, maxMs: MAX_HYDRATION_WAIT_MS });
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(PluginEventResult.error(event.id, `Hydration timeout: exceeded maximum wait time of ${MAX_HYDRATION_WAIT_MS}ms`));
                        return;
                    }

                    if (this.collectionHydrationStatuses.get(collectionName) === "rejected") {
                        logger.warn('[OptimisticReplicationDbPlugin] Hydration rejected while polling', { collectionName, waitedMs: delta });
                        done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                        return;
                    }

                    if (this.collectionHydrationStatuses.get(collectionName) === "fulfilled") {
                        logger.debug('[OptimisticReplicationDbPlugin] Hydration fulfilled while polling, querying read plugin', { collectionName, waitedMs: delta });
                        // Hydration completed successfully, proceed with query
                        readPlugin.query(event, (readResult) => {
                            if (readResult.ok === Result.ERROR) {
                                done(readResult);
                                return;
                            }
                            done(readResult);
                        });
                        return;
                    }

                    // Still pending, check again after interval
                    setTimeout(pollHydrationStatus, HYDRATION_POLL_INTERVAL_MS);
                }

                pollHydrationStatus();
                return;
            }

            // Collection is hydrated for the targeted collection and should be in sync
            logger.debug('[OptimisticReplicationDbPlugin] Collection hydrated, querying read plugin', { collectionName });
            readPlugin.query(event, (readResult) => {

                if (readResult.ok === Result.ERROR) {
                    logger.warn('[OptimisticReplicationDbPlugin] Read plugin query failed', { collectionName, error: readResult.error });
                    done(readResult);
                    return;
                }

                logger.debug('[OptimisticReplicationDbPlugin] Query completed successfully', { collectionName });
                done(readResult);
                return;

            });
        } catch (e: any) {
            logger.error('[OptimisticReplicationDbPlugin] Query threw', { collectionName: event.operation.schema.collectionName, error: e });
            done(PluginEventResult.error(event.id, e));
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        try {

            const workPipeline = new WorkPipeline();
            const plugins = [this.plugins.source, this.plugins.read];

            for (let i = 0, length = plugins.length; i < length; i++) {
                workPipeline.pipe((done) => this.plugins.source.destroy(event, done));
            }

            workPipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    logger.error('[OptimisticReplicationDbPlugin] destroy failed', { eventId: event.id, error: result.error });
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                logger.info('[OptimisticReplicationDbPlugin] destroy completed successfully', { eventId: event.id });
                done(PluginEventResult.success(event.id));
            });

        } catch (e: any) {
            logger.error('[OptimisticReplicationDbPlugin] destroy threw', { eventId: event.id, error: e });
            done(PluginEventResult.error(event.id, e));
        }
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        try {
            const schemaIds = Array.from(event.operation.keys());
            logger.debug('[OptimisticReplicationDbPlugin] bulkPersist started', { eventId: event.id, schemaIds });

            // Since we are doing optimistic, we insert into the read plugin first and assume later plugins will succeed
            // This means the read plugin will generate ids for the source plugin
            this.plugins.read.bulkPersist({
                id: uuid(8),
                operation: event.operation,
                schemas: event.schemas,
                source: "OptimisticReplicationDbPlugin",
                action: "persist"
            }, (r) => {

                if (r.ok !== Result.SUCCESS) {
                    logger.error('[OptimisticReplicationDbPlugin] Read plugin bulkPersist failed', { eventId: event.id, error: r.error });
                    done(r);
                    return;
                }

                logger.info('[OptimisticReplicationDbPlugin] Read plugin bulkPersist succeeded (optimistic done)', { eventId: event.id });
                // optimistically call done and still continue saving the rest of the data.  We read from the memory
                // db anyways
                done(r);

                const optimisticBulkPersistChanges = new BulkPersistChanges();

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                resolveBulkPersistChanges(event, r.data, optimisticBulkPersistChanges);

                setTimeout(() => {
                    this.plugins.source.bulkPersist({
                        id: uuid(8),
                        operation: optimisticBulkPersistChanges,
                        schemas: event.schemas,
                        source: "OptimisticReplicationDbPlugin",
                        action: "persist"
                    }, (r) => {

                        if (r.ok === Result.ERROR) {
                            return;
                        }

                        logger.debug('[OptimisticReplicationDbPlugin] Deferred plugin bulkPersist succeeded', { eventId: event.id });
                    });
                }, 5);
            });

        } catch (e: any) {
            logger.error('[OptimisticReplicationDbPlugin] bulkPersist threw', { eventId: event.id, error: e });
            done(PluginEventResult.error(event.id, e));
        }
    }
}