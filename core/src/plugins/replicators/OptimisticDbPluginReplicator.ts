import { CallbackPartialResult, CallbackResult, Result, SuccessType } from '../../results';
import { DbPluginBulkPersistEvent, DbPluginEvent, DbPluginQueryEvent, IDbPlugin, OptimisticReplicationPluginOptions } from '../types';
import { WorkPipeline } from '../../pipeline';
import { CollectionChanges, PendingChanges, ResolvedChanges } from '../../collections';
import { CompiledSchema, InferCreateType, SchemaId } from '../../schema';
import { assertIsNotNull } from '../../assertions';
import { Query } from '../query';

const getMemoryPluginCollectionSize = <T extends {}>(plugin: IDbPlugin, schema: CompiledSchema<T>): number => {

    if ("getCollectionSize" in plugin && typeof plugin.getCollectionSize === "function") {
        return plugin.getCollectionSize(schema.collectionName) as number;
    }

    throw new Error("Cannot get size of collection for MemoryPlugin, not an instance of MemoryPlugin")
}

export class OptimisticDbPluginReplicator {

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
        return new OptimisticDbPluginReplicator(plugins);
    }

    /**
     * Will query the read plugin if there is one, otherwise the source plugin will be queried
    */
    query<TEntity extends {}, TShape extends any = TEntity>(event: DbPluginQueryEvent<TEntity, TShape>, done: CallbackResult<TShape>): void {
        try {

            const readPlugin = this.plugins.read;
            const sourcePlugin = this.plugins.source;
            const collectionSize = getMemoryPluginCollectionSize(this.plugins.read, event.operation.schema);

            if (collectionSize === 0) {
                // nothing is hydrated, let's try and hydrate before querying
                // Memory plugin might not be hydrated, lets hydrate it for the targeted schema only,
                // Other queries will do the same and hydrate if needed
                // We want to select all data here
                sourcePlugin.query<TEntity, TShape>({
                    schemas: event.schemas,

                    // Select All Data
                    operation: Query.EMPTY<TEntity, TShape>(event.operation.schema)
                }, (sourceResult) => {

                    if (sourceResult.ok === Result.ERROR) {
                        done(sourceResult);
                        return;
                    }

                    if (sourceResult == null || (Array.isArray(sourceResult.data) && sourceResult.data.length === 0)) {
                        done(sourceResult);
                        return;
                    }

                    if (Array.isArray(sourceResult.data) === false) {
                        done(Result.error("Query result is not an array"));
                        return;
                    }

                    const changesCollection = new PendingChanges<TEntity>();
                    const changes = new CollectionChanges<TEntity>()

                    changes.adds.entities = sourceResult.data;

                    changesCollection.changes.set(event.operation.schema.id, changes);

                    readPlugin.bulkPersist({
                        schemas: event.schemas,
                        operation: changesCollection
                    }, (readPersistResult) => {

                        if (readPersistResult.ok === Result.ERROR) {
                            done(readPersistResult);
                            return;
                        }

                        // requery the read plugin
                        readPlugin.query(event, done);
                    });
                });
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
            done(Result.error(e));
        }
    }

    destroy<TEntity extends {}>(event: DbPluginEvent<TEntity>, done: CallbackResult<never>): void {
        try {

            const workPipeline = new WorkPipeline();
            const plugins = [this.plugins.source, ...this.plugins.replicas];

            for (let i = 0, length = plugins.length; i < length; i++) {
                workPipeline.pipe((done) => plugins[i].destroy(event, done));
            }

            workPipeline.filter((result) => {

                if (result.ok === Result.ERROR) {
                    done(result);
                    return;
                }

                done(Result.success());
            });

        } catch (e: any) {
            done(Result.error(e));
        }
    }

    bulkPersist<TEntity extends {}>(event: DbPluginBulkPersistEvent<TEntity>, done: CallbackPartialResult<ResolvedChanges<TEntity>>): void {
        try {

            const workPipeline = new WorkPipeline();
            const deferredPlugins = [this.plugins.source, ... this.plugins.replicas];

            assertIsNotNull(this.plugins.read, "Read plugin cannot be null or undefined for optimistic updates");

            // since we are doing optimistic, we insert into the read plugin first and assume later plugins will succeed
            this.plugins.read.bulkPersist({
                operation: event.operation,
                schemas: event.schemas
            }, (r) => {

                if (r.ok !== Result.SUCCESS) {
                    done(r);
                    return;
                }

                // optimistically call done and still continue saving the rest of the data.  We read from the memory
                // db anyways
                done(r);

                // make sure we swap the adds here, that way we can make sure other persist events
                // don't take their additions and try to change subsequent calls
                const adds = r.data.result.adds();
                const schemaIds = new Set(adds.data.map(x => x[0]));

                for (const schemaId of schemaIds) {
                    const schemaOperations = event.operation.changes.get(schemaId);
                    schemaOperations.adds.entities = [];
                }

                for (const [schemaId, item] of adds.data) {
                    const schemaOperations = event.operation.changes.get(schemaId);

                    // replace additions on the event with the saved changes so 
                    // the rest of the plugins will get any additons who's id's have been set                   
                    schemaOperations.adds.entities.push(item as InferCreateType<TEntity>);
                }

                for (let i = 0, length = deferredPlugins.length; i < length; i++) {
                    workPipeline.pipe((d) => {

                        const plugin = deferredPlugins[i];

                        plugin.bulkPersist({
                            operation: event.operation,
                            schemas: event.schemas
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
            done(Result.error(e));
        }
    }
}