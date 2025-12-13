import { PluginEventCallbackPartialResult, PluginEventCallbackResult, PluginEventResult, Result } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, OptimisticReplicationPluginOptions } from '../types';
import { WorkPipeline } from '../../pipeline'; 7
import { CompiledSchema } from '../../schema';
import { Query } from '../query';
import { resolveBulkPersistChanges, uuid } from '../../utilities';
import { BulkPersistChanges, BulkPersistResult } from '../../collections';
import { ITranslatedValue } from '../translators';
import { now } from '../../performance';

const getMemoryPluginCollectionSize = <T extends {}>(plugin: IDbPlugin, schema: CompiledSchema<T>): number => {

    if ("getCollectionSize" in plugin && typeof plugin.getCollectionSize === "function") {
        return plugin.getCollectionSize(schema.collectionName) as number;
    }

    throw new Error("Cannot get size of collection for MemoryPlugin, not an instance of MemoryPlugin");
}

const MAX_HYDRATION_WAIT_MS = 60_000; // 60 seconds max wait
const HYDRATION_POLL_INTERVAL_MS = 10; // Check ever 10 ms

type HydrationStatus =
    | "hydration-not-started"
    | "hydration-pending"
    | "hydration-error"
    | "hydration-success";

let hydrationStatus: HydrationStatus = "hydration-not-started";

export class OptimisticReplicationDbPlugin implements IDbPlugin {

    protected plugins: OptimisticReplicationPluginOptions;

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
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: PluginEventCallbackResult<ITranslatedValue<TShape>>): void {
        try {

            const readPlugin = this.plugins.read;
            const sourcePlugin = this.plugins.source;
            const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, event.operation.schema);

            if (collectionSize === 0 && hydrationStatus === "hydration-not-started") {

                // Notify the cache that the db was hydrated right away
                hydrationStatus = "hydration-pending";

                // nothing is hydrated, let's try and hydrate before querying
                // Memory plugin might not be hydrated, lets hydrate it for the targeted schema only,
                // Other queries will do the same and hydrate if needed
                // We want to select all data here
                sourcePlugin.query<TEntity, TShape>({
                    id: uuid(8),
                    schemas: event.schemas,
                    source: "collection",
                    // Select All Data
                    operation: Query.EMPTY<TEntity, TShape>(event.operation.schema)
                }, (sourceResult) => {

                    if (sourceResult.ok === Result.ERROR) {

                        // Notify that hydration failed
                        hydrationStatus = "hydration-error";
                        done(sourceResult);
                        return;
                    }

                    // Source plugin can have no data, still should succeed
                    if (Array.isArray(sourceResult.data.value) === false) {
                        // Notify that hydration failed
                        hydrationStatus = "hydration-error";
                        done(PluginEventResult.error(event.id, "Query result is not an array"));
                        return;
                    }

                    const changesCollection = new BulkPersistChanges();
                    const schemaChanges = changesCollection.resolve(event.operation.schema.id);

                    // Add the existing items into the persist payload as adds
                    schemaChanges.adds = sourceResult.data.value;

                    readPlugin.bulkPersist({
                        id: uuid(8),
                        schemas: event.schemas,
                        operation: changesCollection,
                        source: "collection",
                    }, (readPersistResult) => {

                        if (readPersistResult.ok === Result.ERROR) {
                            // Notify that hydration failed
                            hydrationStatus = "hydration-error";
                            done(readPersistResult);
                            return;
                        }

                        hydrationStatus = "hydration-success";

                        // requery the read plugin
                        readPlugin.query(event, done);
                    });
                });

                return;
            }

            if (hydrationStatus === "hydration-error") {
                done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                return;
            }

            // If hydration is pending, do not query empty collection, wait for hydration
            if (hydrationStatus === "hydration-pending") {
                const start = now();
                const pollHydrationStatus = () => {
                    const delta = now() - start;

                    if (delta > MAX_HYDRATION_WAIT_MS) {
                        hydrationStatus = "hydration-error";
                        done(PluginEventResult.error(event.id, `Hydration timeout: exceeded maximum wait time of ${MAX_HYDRATION_WAIT_MS}ms`));
                        return;
                    }

                    if (hydrationStatus === "hydration-error") {
                        done(PluginEventResult.error(event.id, "Hydration failed, unable to query read plugin"));
                        return;
                    }

                    if (hydrationStatus === "hydration-success") {
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
            readPlugin.query(event, (readResult) => {

                if (readResult.ok === Result.ERROR) {
                    done(readResult);
                    return;
                }

                done(readResult);
                return;

            });
        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    destroy(event: DbPluginEvent, done: PluginEventCallbackResult<never>): void {
        try {

            const workPipeline = new WorkPipeline();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            for (let i = 0, length = plugins.length; i < length; i++) {
                workPipeline.pipe((done) => plugins[i].destroy(event, done));
            }

            workPipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(PluginEventResult.error(event.id, result.error));
                    return;
                }

                done(PluginEventResult.success(event.id));
            });

        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }

    bulkPersist(event: DbPluginBulkPersistEvent, done: PluginEventCallbackPartialResult<BulkPersistResult>): void {
        try {

            const workPipeline = new WorkPipeline();
            const deferredPlugins = [this.plugins.source, ... this.plugins.replicas];

            // Since we are doing optimistic, we insert into the read plugin first and assume later plugins will succeed
            // This means the read plugin will generate ids for the source plugin
            this.plugins.read.bulkPersist({
                id: uuid(8),
                operation: event.operation,
                schemas: event.schemas,
                source: "data-store",
            }, (r) => {

                if (r.ok !== Result.SUCCESS) {
                    done(r);
                    return;
                }

                // optimistically call done and still continue saving the rest of the data.  We read from the memory
                // db anyways
                done(r);

                const optimisticBulkPersistChanges = new BulkPersistChanges();

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                resolveBulkPersistChanges(event, r.data, optimisticBulkPersistChanges);

                for (let i = 0, length = deferredPlugins.length; i < length; i++) {
                    workPipeline.pipe((d) => {

                        const plugin = deferredPlugins[i];

                        plugin.bulkPersist({
                            id: uuid(8),
                            operation: optimisticBulkPersistChanges,
                            schemas: event.schemas,
                            source: "data-store",
                        }, (r) => {

                            if (r.ok === Result.ERROR) {
                                d(r);
                                return;
                            }

                            d(Result.success());
                        });
                    });
                }

                setTimeout(() => {
                    workPipeline.filter((_) => {
                        // no-op for now, maybe implement retries?
                    });
                }, 5);
            });

        } catch (e: any) {
            done(PluginEventResult.error(event.id, e));
        }
    }
}