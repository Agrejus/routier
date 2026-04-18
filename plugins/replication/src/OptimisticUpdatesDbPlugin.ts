import { BulkPersistChanges, BulkPersistResult } from "@routier/core/collections";
import { now } from "@routier/core/performance";
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, ITranslatedValue, Query } from "@routier/core/plugins";
import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from "@routier/core/results";
import { CompiledSchema } from "@routier/core/schema";
import { logger, uuid } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import { PluginSyncEngine } from "./PluginSyncEngine";

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
    private readonly syncEngine: PluginSyncEngine;

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
        this.syncEngine = new PluginSyncEngine({
            // For optimistic behavior, source in sync engine is the fast read plugin.
            source: this.plugins.read,
            mirrorPlugins: [this.plugins.source],
            persistAckMode: "after-source",
            mirrorFailureMode: "swallow",
            mirrorPersistPayloadMode: "resolve-from-source-result",
        });
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {
            const collectionName = event.operation.schema.collectionName;
            logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Start', { eventId: event.id, collectionName });

            const readPlugin = this.plugins.read;
            const sourcePlugin = this.plugins.source;
            const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, event.operation.schema);

            if (collectionSize === 0 && this.collectionHydrationStatuses.get(collectionName) == null) {

                // Notify the cache that the db was hydrated right away
                this.collectionHydrationStatuses.set(collectionName, "pending");
                logger.info('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration never run, starting', { collectionName });

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
                        logger.error('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration failed', { collectionName, error: sourceResult.error });
                        // Notify that hydration failed
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(sourceResult);
                        return;
                    }

                    // Source plugin can have no data, still should succeed
                    if (Array.isArray(sourceResult.data.value) === false) {
                        logger.error('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration source result is not an array', { collectionName });
                        // Notify that hydration failed
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(PluginEventResult.error(event.id, "Query result is not an array"));
                        return;
                    }

                    const itemCount = sourceResult.data.value.length;
                    logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration success, persisting to read plugin', { collectionName, itemCount });

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
                            logger.error('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration read-plugin bulkPersist failed', { collectionName, error: readPersistResult.error });
                            // Notify that hydration failed
                            this.collectionHydrationStatuses.set(collectionName, "rejected");
                            done(readPersistResult);
                            return;
                        }

                        this.collectionHydrationStatuses.set(collectionName, "fulfilled");
                        logger.info('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration complete, requerying read plugin', { collectionName, itemCount, sourceResult, event });

                        // requery the read plugin
                        readPlugin.query(event, r => {

                            logger.info('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration complete, requerying read plugin', { response: r });
                            done(r);
                        });
                    });
                });

                return;
            }

            if (this.collectionHydrationStatuses.get(collectionName) === "rejected") {
                logger.warn('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Query rejected: hydration previously failed', { collectionName });
                done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                return;
            }

            // If hydration is pending, do not query empty collection, wait for hydration
            if (this.collectionHydrationStatuses.get(collectionName) === "pending") {
                logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration pending, polling until fulfilled or timeout', { collectionName });
                const start = now();
                const pollHydrationStatus = () => {
                    const delta = now() - start;

                    if (delta > MAX_HYDRATION_WAIT_MS) {
                        logger.error('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration timeout', { collectionName, waitedMs: delta, maxMs: MAX_HYDRATION_WAIT_MS });
                        this.collectionHydrationStatuses.set(collectionName, "rejected");
                        done(PluginEventResult.error(event.id, `Hydration timeout: exceeded maximum wait time of ${MAX_HYDRATION_WAIT_MS}ms`));
                        return;
                    }

                    if (this.collectionHydrationStatuses.get(collectionName) === "rejected") {
                        logger.warn('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration rejected while polling', { collectionName, waitedMs: delta });
                        done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                        return;
                    }

                    if (this.collectionHydrationStatuses.get(collectionName) === "fulfilled") {
                        logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Hydration fulfilled while polling, querying read plugin', { collectionName, waitedMs: delta });
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
            logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Collection is hydrated, querying read plugin', { collectionName });
            readPlugin.query(event, (readResult) => {

                if (readResult.ok === Result.ERROR) {
                    logger.warn('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Read plugin query failed', { collectionName, error: readResult.error });
                    done(readResult);
                    return;
                }

                logger.debug('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Query completed successfully', { collectionName, readResult });
                done(readResult);
                return;

            });
        } catch (e: any) {
            logger.error('[OptimisticReplicationDbPlugin] OptimisticUpdatesDbPlugin.query() -> Query threw', { collectionName: event.operation.schema.collectionName, error: e });
            done(PluginEventResult.error(event.id, e));
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        this.syncEngine.destroy(event, done);
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        this.syncEngine.bulkPersist({
            ...event,
            id: uuid(8),
            source: "OptimisticReplicationDbPlugin",
            action: "persist"
        }, done);
    }
}